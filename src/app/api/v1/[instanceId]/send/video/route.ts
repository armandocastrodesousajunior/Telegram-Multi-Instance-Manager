import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { ProviderFactory } from '@/lib/telegram/providers/ProviderFactory';
import { getCachedMedia, saveMediaToCache } from '@/lib/telegram/mediaCache';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { getOrFetchEntity } from '@/lib/telegram/utils';

export async function POST(req: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  let authInstanceId = undefined;
  try {
    if (typeof params !== 'undefined') {
      const p = await params;
      authInstanceId = (p as any).instanceId || (p as any).id;
    }
  } catch(e) {}
  if (!(await checkAuth(req, authInstanceId))) return unauthorizedResponse();

  try {
    const { instanceId } = await params;
    const body = await req.json();
    const { chatId, url, caption, replyToMsgId, viewOnce, parseMode } = body;

    if (!chatId || !url) {
      return NextResponse.json({ error: 'chatId and url are required' }, { status: 400 });
    }

    const instance = await prisma.instance.findUnique({ where: { id: instanceId } });
    if (!instance) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    const provider = await ProviderFactory.getProvider(instance);

    const settings = await prisma.instanceSettings.findUnique({ where: { instanceId } });

    // ── View Once ──────────────────────────────────────────────────────────────
    // Usa API de baixo nível (sem monkey-patching de client.invoke) para evitar
    // race condition entre requisições concorrentes.
    if (viewOnce) {
      await provider.simulateFileAction(chatId, 'video');

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
        const message = await provider.sendViewOnceFile(chatId, tempPath, 'video', {
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
    await provider.simulateFileAction(chatId, 'video');

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
        message = await provider.sendFile(chatId, fileData, {
          caption: caption || '',
          replyToMsgId: replyToMsgId,
          parseMode: parseMode || undefined,
        });
      } catch (uploadErr: any) {
        if (uploadErr.message?.includes('FILE_REFERENCE_EXPIRED') && cachedMedia) {
          console.log(`[VideoRoute] Cache expirado para ${url}. Tentando novamente com URL original...`);
          await prisma.mediaCache.deleteMany({ where: { instanceId, url } });
          cachedMedia = null;
          fileData = tempPath && fs.existsSync(tempPath) ? tempPath : url;
          message = await provider.sendFile(chatId, fileData, {
            caption: caption || '',
            replyToMsgId: replyToMsgId,
            parseMode: parseMode || undefined,
          });
        } else {
          throw uploadErr;
        }
      }

      if (settings?.mediaCacheEnabled && !cachedMedia && instance.type !== 'BOT') {
        await saveMediaToCache(instanceId, url, message.nativeMessage, 0);
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
