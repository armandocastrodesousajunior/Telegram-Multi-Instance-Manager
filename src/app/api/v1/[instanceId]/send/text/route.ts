import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { ProviderFactory } from '@/lib/telegram/providers/ProviderFactory';
import { logApiRequest } from '@/lib/logger';
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
    const requestStartTime = Date.now();
    const { instanceId } = await params;
    const body = await req.json();
    const { chatId, text, replyToMsgId, parseMode } = body;

    if (!chatId || !text) {
      const err = { error: 'chatId and text are required' };
      await logApiRequest({ instanceId, endpoint: '/send/text', method: 'POST', requestBody: body, responseStatus: 400, responseBody: err, success: false });
      return NextResponse.json(err, { status: 400 });
    }

    const instance = await prisma.instance.findUnique({ where: { id: instanceId } });
    if (!instance) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    const provider = await ProviderFactory.getProvider(instance);
    
    // Fetch instance settings to check for split messages option
    const settings = await prisma.instanceSettings.findUnique({
      where: { instanceId }
    });
    
    const splitEnabled = settings ? settings.splitMessagesEnabled : true;
    let resData: any;

    if (splitEnabled && text.includes('\n\n')) {
      const parts = text.split('\n\n').filter((p: string) => p.trim() !== '');
      const messageIds: number[] = [];
      const actions: any[] = [];
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const tSim = Date.now();
        await provider.simulateTyping(chatId, part);
        const simulationMs = Date.now() - tSim;
        
        const tSend = Date.now();
        const message = await provider.sendMessage(chatId, part, {
          replyToMsgId: i === 0 ? replyToMsgId : undefined, // Reply only to the first part
          parseMode: parseMode || undefined
        });
        const telegramSendMs = Date.now() - tSend;
        messageIds.push(message.id);
        const total = simulationMs + telegramSendMs;
        actions.push({ simulationMs, telegramSendMs, totalActionMs: total, totalTimingMs: total, totalMs: total });
      }
      
      const totalRequestMs = Date.now() - requestStartTime;
      const messages = messageIds.map((id, index) => ({
        success: true,
        id,
        timing: actions[index] || {}
      }));
      resData = { success: true, totalTimingMs: totalRequestMs, messages };
    } else {
      // Normal behavior
      const tSim = Date.now();
      if (body.typingTime) {
        await provider.simulateTyping(chatId, body.typingTime);
      } else {
        await provider.simulateTyping(chatId, body.text);
      }
      const simulationMs = Date.now() - tSim;

      const tSend = Date.now();
      const message = await provider.sendMessage(chatId, text, {
        replyToMsgId: replyToMsgId,
        parseMode: parseMode || undefined
      });
      const telegramSendMs = Date.now() - tSend;

      const totalRequestMs = Date.now() - requestStartTime;
      const total = simulationMs + telegramSendMs;
      const messages = [
        {
          success: true,
          id: message.id,
          timing: { simulationMs, telegramSendMs, totalActionMs: total, totalTimingMs: total, totalMs: total }
        }
      ];
      resData = { success: true, totalTimingMs: totalRequestMs, messages };
    }
    await logApiRequest({ instanceId, endpoint: '/send/text', method: 'POST', requestBody: body, responseStatus: 200, responseBody: resData, success: true });
    return NextResponse.json(resData);
  } catch (err: any) {
    const errBody = { error: err.message };
    // Try to get body if it failed early it might be undefined, but we'll pass it if we can.
    await logApiRequest({ instanceId: (await params).instanceId, endpoint: '/send/text', method: 'POST', requestBody: null, responseStatus: 500, responseBody: errBody, success: false });
    return NextResponse.json(errBody, { status: 500 });
  }
}
