import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { telegramManager } from '@/lib/telegram/client';


export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ instanceId: string, chatId: string, messageId: string }> }
) {
  // This is a public route, no authentication required.

  const { instanceId, chatId, messageId } = await params;

  try {
    const client = await telegramManager.getClient(instanceId);
    
    // Parse identifiers
    const msgId = parseInt(messageId, 10);
    let peer: any = chatId;
    if (!isNaN(Number(chatId))) {
      peer = BigInt(chatId);
    }
    
    // Fetch the specific message
    const messages = await client.getMessages(peer, { ids: [msgId] });
    if (!messages || messages.length === 0 || !messages[0]) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const message = messages[0];
    if (!message.media) {
      return NextResponse.json({ error: 'Message has no media' }, { status: 400 });
    }

    // Stream download directly from Telegram
    const buffer = await client.downloadMedia(message);
    if (!buffer) {
       return NextResponse.json({ error: 'Could not download media or media is unsupported' }, { status: 500 });
    }

    // Attempt to guess mimeType
    let mimeType = 'application/octet-stream';
    let extension = 'bin';

    if (message.photo) {
      mimeType = 'image/jpeg';
      extension = 'jpg';
    } else if (message.video) {
      mimeType = 'video/mp4';
      extension = 'mp4';
    } else if (message.audio) {
      // Telegram audio is usually ogg/opus or mp3
      mimeType = 'audio/mpeg';
      extension = 'mp3';
    } else if (message.voice) {
      mimeType = 'audio/ogg';
      extension = 'ogg';
    } else if (message.gif) {
      mimeType = 'video/mp4';
      extension = 'mp4'; // Telegram saves GIFs as MP4 usually
    } else if (message.document) {
      // Find mime type in attributes if available
      if ((message.document as any).mimeType) {
        mimeType = (message.document as any).mimeType;
      }
      
      // Attempt to extract filename from attributes
      const attributes = (message.document as any).attributes;
      if (attributes) {
        const fileAttr = attributes.find((a: any) => a.className === 'DocumentAttributeFilename');
        if (fileAttr && fileAttr.fileName) {
          const parts = fileAttr.fileName.split('.');
          if (parts.length > 1) {
            extension = parts.pop();
          }
        }
      }
    }

    const headers = new Headers();
    headers.set('Content-Type', mimeType);
    headers.set('Content-Disposition', `inline; filename="media_${messageId}.${extension}"`);
    // Ensure buffer is treated as a Buffer (sometimes GramJS typing says it could be string)
    const mediaBuffer = buffer as Buffer;
    return new NextResponse(mediaBuffer as unknown as BodyInit, { status: 200, headers });
  } catch (err: any) {
    console.error("Download media error:", err);
    return NextResponse.json({ error: err.message || 'Internal Error' }, { status: 500 });
  }
}
