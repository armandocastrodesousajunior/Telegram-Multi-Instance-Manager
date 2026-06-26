import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { telegramManager } from '@/lib/telegram/client';
import { simulateTyping } from '@/lib/telegram/actions';
import { logApiRequest } from '@/lib/logger';

export async function POST(req: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { instanceId } = await params;
    const body = await req.json();
    const { chatId, text, replyToMsgId } = body;

    if (!chatId || !text) {
      const err = { error: 'chatId and text are required' };
      await logApiRequest({ instanceId, endpoint: '/send/text', method: 'POST', requestBody: body, responseStatus: 400, responseBody: err, success: false });
      return NextResponse.json(err, { status: 400 });
    }

    const client = await telegramManager.getClient(instanceId);
    await simulateTyping(client, instanceId, chatId, text);

    const message = await client.sendMessage(chatId, {
      message: text,
      replyTo: replyToMsgId
    });

    const resData = { success: true, messageId: message.id };
    await logApiRequest({ instanceId, endpoint: '/send/text', method: 'POST', requestBody: body, responseStatus: 200, responseBody: resData, success: true });
    return NextResponse.json(resData);
  } catch (err: any) {
    const errBody = { error: err.message };
    // Try to get body if it failed early it might be undefined, but we'll pass it if we can.
    await logApiRequest({ instanceId: (await params).instanceId, endpoint: '/send/text', method: 'POST', requestBody: null, responseStatus: 500, responseBody: errBody, success: false });
    return NextResponse.json(errBody, { status: 500 });
  }
}
