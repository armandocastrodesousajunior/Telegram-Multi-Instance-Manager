import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { telegramManager } from '@/lib/telegram/client';
import { simulateFileAction } from '@/lib/telegram/actions';
import { getCachedMedia, saveMediaToCache } from '@/lib/telegram/mediaCache';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { instanceId } = await params;
    const { chatId, url, replyToMsgId } = await req.json();

    if (!chatId || !url) {
      return NextResponse.json({ error: 'chatId and url are required' }, { status: 400 });
    }

    const client = await telegramManager.getClient(instanceId);
    await simulateFileAction(client, instanceId, chatId, 'audio');

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

    const message = await client.sendFile(chatId, {
      file: fileData,
      replyTo: replyToMsgId,
      voiceNote: true
    });

    if (settings?.mediaCacheEnabled && !cachedMedia) {
      await saveMediaToCache(instanceId, url, message, 0);
    }

    return NextResponse.json({ success: true, messageId: message.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
