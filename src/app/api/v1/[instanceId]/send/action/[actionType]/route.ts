import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { ProviderFactory } from '@/lib/telegram/providers/ProviderFactory';
import { logApiRequest } from '@/lib/logger';
import { getCachedInstance } from '@/lib/telegram/utils';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string; actionType: string }> }
) {
  let authInstanceId = undefined;
  try {
    if (typeof params !== 'undefined') {
      const p = await params;
      authInstanceId = (p as any).instanceId || (p as any).id;
    }
  } catch (e) {}
  if (!(await checkAuth(req, authInstanceId))) return unauthorizedResponse();

  try {
    const requestStartTime = Date.now();
    const { instanceId, actionType } = await params;
    const body = await req.json();
    const { chatId, action, durationSeconds, duration, wait = false } = body;

    if (!chatId) {
      const err = { error: 'chatId is required' };
      await logApiRequest({
        instanceId,
        endpoint: `/send/action/${actionType}`,
        method: 'POST',
        requestBody: body,
        responseStatus: 400,
        responseBody: err,
        success: false
      });
      return NextResponse.json(err, { status: 400 });
    }

    const instance = await getCachedInstance(instanceId);
    if (!instance) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });

    const provider = await ProviderFactory.getProvider(instance);

    const chosenAction = action || actionType;
    const dur = durationSeconds !== undefined ? durationSeconds : duration;
    const actionResult = await provider.sendChatAction(chatId, chosenAction, dur, wait);

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

    await logApiRequest({
      instanceId,
      endpoint: `/send/action/${actionType}`,
      method: 'POST',
      requestBody: body,
      responseStatus: 200,
      responseBody: resData,
      success: true
    });
    return NextResponse.json(resData);
  } catch (err: any) {
    const p = await params;
    const errBody = { error: err.message };
    await logApiRequest({
      instanceId: p.instanceId,
      endpoint: `/send/action/${p.actionType}`,
      method: 'POST',
      requestBody: null,
      responseStatus: 500,
      responseBody: errBody,
      success: false
    });
    return NextResponse.json(errBody, { status: 500 });
  }
}
