import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { telegramManager } from '@/lib/telegram/client';
import { simulateFileAction } from '@/lib/telegram/actions';
import { getCachedMedia, saveMediaToCache } from '@/lib/telegram/mediaCache';
import { getOrFetchEntity } from '@/lib/telegram/utils';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { instanceId } = await params;
    const { chatId, url, caption, replyToMsgId } = await req.json();

    if (!chatId || !url) {
      return NextResponse.json({ error: 'chatId and url are required' }, { status: 400 });
    }

    const client = await telegramManager.getClient(instanceId);
    const resolvedChatId = await getOrFetchEntity(client, chatId);
    await simulateFileAction(client, instanceId, resolvedChatId, 'audio');

    const settings = await prisma.instanceSettings.findUnique({ where: { instanceId } });
    
    let fileData: any = url;
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
      message = await client.sendFile(resolvedChatId, {
        file: fileData,
        caption: caption || '',
        replyTo: replyToMsgId
      });
    } catch (uploadErr: any) {
      if (uploadErr.message?.includes('FILE_REFERENCE_EXPIRED') && cachedMedia) {
        console.log(`[AudioRoute] Cache expirado para ${url}. Tentando novamente com URL original...`);
        await prisma.mediaCache.deleteMany({ where: { instanceId, url } });
        cachedMedia = null;
        fileData = url;
        message = await client.sendFile(resolvedChatId, {
          file: fileData,
          caption: caption || '',
          replyTo: replyToMsgId
        });
      } else {
        throw uploadErr;
      }
    }

    if (settings?.mediaCacheEnabled && !cachedMedia) {
      await saveMediaToCache(instanceId, url, message, 0);
    }

    return NextResponse.json({ success: true, messageId: message.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
