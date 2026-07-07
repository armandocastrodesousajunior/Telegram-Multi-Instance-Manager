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
    await simulateFileAction(client, instanceId, chatId, 'photo');

    // Intercept API call to inject viewOnce if requested
    const originalInvoke = client.invoke.bind(client);
    if (viewOnce) {
      client.invoke = async (req: any) => {
        if (req.className === 'messages.SendMedia' && req.media) {
          req.media.ttlSeconds = 2147483647; // Telegram's standard for infinite view-once
        }
        return await originalInvoke(req);
      };
    }

    const settings = await prisma.instanceSettings.findUnique({ where: { instanceId } });
    
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

    if (viewOnce && !cachedMedia) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const uniqueId = crypto.randomUUID();
          let ext = 'jpg';
          try {
            const urlPath = new URL(url).pathname;
            const parts = urlPath.split('.');
            if (parts.length > 1) ext = parts.pop() || 'jpg';
          } catch(e) {}
          
          tempPath = path.join(os.tmpdir(), `${uniqueId}_image.${ext}`);
          fs.writeFileSync(tempPath, buffer);
          fileData = tempPath; // Passa o caminho físico para forçar o UploadedPhoto
        }
      } catch (fetchErr) {
        console.error("Falha ao baixar imagem para viewOnce, caindo para URL direta:", fetchErr);
      }
    }

    let message: any;
    try {
      try {
        message = await client.sendFile(chatId, {
          file: fileData,
          caption: caption || '',
          replyTo: replyToMsgId,
          parseMode: parseMode || undefined
        });
      } catch (uploadErr: any) {
        if (uploadErr.message?.includes('FILE_REFERENCE_EXPIRED') && cachedMedia) {
          console.log(`[ImageRoute] Cache expirado para ${url}. Tentando novamente com URL original...`);
          await prisma.mediaCache.deleteMany({ where: { instanceId, url } });
          cachedMedia = null;
          fileData = tempPath && fs.existsSync(tempPath) ? tempPath : url;
          message = await client.sendFile(chatId, {
            file: fileData,
            caption: caption || '',
            replyTo: replyToMsgId,
            parseMode: parseMode || undefined
          });
        } else {
          throw uploadErr;
        }
      }
      
      if (settings?.mediaCacheEnabled && !cachedMedia) {
        await saveMediaToCache(instanceId, url, message, 0);
      }
    } finally {
      client.invoke = originalInvoke;
      if (tempPath && fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (e) {}
      }
    }

    return NextResponse.json({ success: true, messageId: message.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
