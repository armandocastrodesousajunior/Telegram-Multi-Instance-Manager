import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { telegramManager } from '@/lib/telegram/client';
import { simulateFileAction } from '@/lib/telegram/actions';

export async function POST(req: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { instanceId } = await params;
    const body = await req.json();
    const { chatId, url, caption, replyToMsgId, viewOnce } = body;

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

    let message;
    try {
      message = await client.sendFile(chatId, {
        file: url,
        caption: caption || '',
        replyTo: replyToMsgId
      });
    } finally {
      // Always restore original invoke
      client.invoke = originalInvoke;
    }

    return NextResponse.json({ success: true, messageId: message.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
