import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { ProviderFactory } from '@/lib/telegram/providers/ProviderFactory';
import { logApiRequest } from '@/lib/logger';
import { getCachedInstance } from '@/lib/telegram/utils';

export async function POST(req: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  let authInstanceId = undefined;
  try {
    if (typeof params !== 'undefined') {
      const p = await params;
      authInstanceId = (p as any).instanceId || (p as any).id;
    }
  } catch (e) {}
  if (!(await checkAuth(req, authInstanceId))) return unauthorizedResponse();

  let requestBody: any = null;
  try {
    const requestStartTime = Date.now();
    const { instanceId } = await params;
    const body = await req.json();
    requestBody = body;
    const { chatId, action = 'typing' } = body;

    if (!chatId) {
      const err = { error: 'chatId is required' };
      await logApiRequest({ instanceId, endpoint: '/send/action', method: 'POST', requestBody: body, responseStatus: 400, responseBody: err, success: false });
      return NextResponse.json(err, { status: 400 });
    }

    const instance = await getCachedInstance(instanceId);
    if (!instance) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });

    const provider = await ProviderFactory.getProvider(instance);

    const actionResult = await provider.sendChatAction(chatId, action);

    const totalRequestMs = Date.now() - requestStartTime;
    const resData = {
      success: true,
      chatId,
      action: actionResult.action,
      durationMs: actionResult.durationMs,
      totalTimingMs: totalRequestMs,
      timing: {
        actionMs: actionResult.durationMs,
        peerResolution: actionResult.peerResolution
      }
    };

    await logApiRequest({ instanceId, endpoint: '/send/action', method: 'POST', requestBody: body, responseStatus: 200, responseBody: resData, success: true });
    return NextResponse.json(resData);
  } catch (err: any) {
    const errMsg = String(err?.message || err || '');
    const isForbidden = errMsg.includes('CHAT_WRITE_FORBIDDEN') || errMsg.includes('USER_IS_BLOCKED') || errMsg.includes('YOU_BLOCKED_USER');
    const isFlood = errMsg.includes('FLOOD_WAIT') || errMsg.includes('PEER_FLOOD');
    const isBadRequest = errMsg.includes('CHAT_ID_INVALID') || errMsg.includes('PEER_ID_INVALID');
    const status = isForbidden ? 403 : isFlood ? 429 : isBadRequest ? 400 : 500;

    let explanation: string | undefined = undefined;
    if (isForbidden) {
      explanation = 'Não foi possível enviar a ação: o destinatário bloqueou a conta, possui configurações restritas de privacidade (Telegram Premium) ou este chat não permite envio de mensagens.';
    } else if (isFlood) {
      explanation = 'Limite de requisições temporário do Telegram atingido (Flood). Aguarde alguns instantes.';
    }

    const errBody: any = { 
      error: errMsg,
      ...(explanation ? { details: explanation } : {})
    };

    let instanceIdToLog = authInstanceId;
    try {
      instanceIdToLog = (await params).instanceId;
    } catch(e) {}

    await logApiRequest({ 
      instanceId: instanceIdToLog || '', 
      endpoint: '/send/action', 
      method: 'POST', 
      requestBody: requestBody, 
      responseStatus: status, 
      responseBody: errBody, 
      success: false 
    });
    return NextResponse.json(errBody, { status });
  }
}
