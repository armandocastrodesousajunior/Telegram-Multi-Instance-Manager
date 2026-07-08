import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { telegramManager } from '@/lib/telegram/client';
import { simulateFileAction } from '@/lib/telegram/actions';
import { getCachedMedia, saveMediaToCache } from '@/lib/telegram/mediaCache';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { getOrFetchEntity } from '@/lib/telegram/utils';
import { sendViewOnceFile } from '@/lib/telegram/viewOnce';

export async function POST(req: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { instanceId } = await params;
    const body = await req.json();
    const { chatId, url, caption, replyToMsgId, viewOnce, parseMode } = body;

    if (!chatId || !url) {
      return NextResponse.json({ error: 'chatId and url are required' }, { status: 400 });
    }

    const client = await telegramManager.getClient(instanceId);
    const resolvedChatId = await getOrFetchEntity(client, chatId);

    const settings = await prisma.instanceSettings.findUnique({ where: { instanceId } });

    // ── View Once ──────────────────────────────────────────────────────────────
    // Usa API de baixo nível (sem monkey-patching de client.invoke) para evitar
    // race condition entre requisições concorrentes.
    if (viewOnce) {
      await simulateFileAction(client, instanceId, resolvedChatId, 'video');

      let tempPath: string | null = null;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Falha ao baixar vídeo: HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const uniqueId = crypto.randomUUID();
        let ext = 'mp4';
        try {
          const parts = new URL(url).pathname.split('.');
          if (parts.length > 1) ext = parts.pop() || 'mp4';
        } catch (e) {}
        tempPath = path.join(os.tmpdir(), `${uniqueId}_vo_video.${ext}`);
        fs.writeFileSync(tempPath, buffer);

        const ttlSeconds = settings?.viewOnceTtlSeconds ?? 2147483647;
        const message = await sendViewOnceFile(client, resolvedChatId, {
          tempPath,
          mediaType: 'video',
          caption: caption || '',
          replyToMsgId,
          ttlSeconds,
          parseMode,
        });

        return NextResponse.json({ success: true, messageId: message.id });
      } finally {
        if (tempPath && fs.existsSync(tempPath)) {
          try { fs.unlinkSync(tempPath); } catch (e) {}
        }
      }
    }

    // ── Envio Normal (sem view once) ───────────────────────────────────────────
    await simulateFileAction(client, instanceId, resolvedChatId, 'video');

    let fileData: any = url;
    let tempPath: string | null = null;
    let cachedMedia = null;

    if (settings?.mediaCacheEnabled) {
      const cached = await getCachedMedia(instanceId, url);
      if (cached) {
        cachedMedia = cached.media;
        fileData = cachedMedia;
      }
    }

    let message: any;
    try {
      try {
        message = await client.sendFile(resolvedChatId, {
          file: fileData,
          caption: caption || '',
          replyTo: replyToMsgId,
          parseMode: parseMode || undefined,
          videoNote: false,
        });
      } catch (uploadErr: any) {
        if (uploadErr.message?.includes('FILE_REFERENCE_EXPIRED') && cachedMedia) {
          console.log(`[VideoRoute] Cache expirado para ${url}. Tentando novamente com URL original...`);
          await prisma.mediaCache.deleteMany({ where: { instanceId, url } });
          cachedMedia = null;
          fileData = tempPath && fs.existsSync(tempPath) ? tempPath : url;
          message = await client.sendFile(resolvedChatId, {
            file: fileData,
            caption: caption || '',
            replyTo: replyToMsgId,
            parseMode: parseMode || undefined,
            videoNote: false,
          });
        } else {
          throw uploadErr;
        }
      }

      if (settings?.mediaCacheEnabled && !cachedMedia) {
        await saveMediaToCache(instanceId, url, message, 0);
      }
    } finally {
      if (tempPath && fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (e) {}
      }
    }

    return NextResponse.json({ success: true, messageId: message.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
