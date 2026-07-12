import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { ProviderFactory } from '@/lib/telegram/providers/ProviderFactory';
import { getCachedMedia, saveMediaToCache } from '@/lib/telegram/mediaCache';
import { getOrFetchEntity } from '@/lib/telegram/utils';
import { prisma } from '@/lib/db';

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
    const { chatId, url, caption, replyToMsgId } = await req.json();

    if (!chatId || !url) {
      return NextResponse.json({ error: 'chatId and url are required' }, { status: 400 });
    }

    const instance = await prisma.instance.findUnique({ where: { id: instanceId } });
    if (!instance) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    const provider = await ProviderFactory.getProvider(instance);
    await provider.simulateFileAction(chatId, 'audio');

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
      message = await provider.sendFile(chatId, fileData, {
        caption: caption || '',
        replyToMsgId: replyToMsgId
      });
    } catch (uploadErr: any) {
      if (uploadErr.message?.includes('FILE_REFERENCE_EXPIRED') && cachedMedia) {
        console.log(`[AudioRoute] Cache expirado para ${url}. Tentando novamente com URL original...`);
        await prisma.mediaCache.deleteMany({ where: { instanceId, url } });
        cachedMedia = null;
        fileData = url;
        message = await provider.sendFile(chatId, fileData, {
          caption: caption || '',
          replyToMsgId: replyToMsgId
        });
      } else {
        throw uploadErr;
      }
    }

    if (settings?.mediaCacheEnabled && !cachedMedia && instance.type !== 'BOT') {
      await saveMediaToCache(instanceId, url, message.nativeMessage, 0);
    }

    return NextResponse.json({ success: true, messageId: message.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
