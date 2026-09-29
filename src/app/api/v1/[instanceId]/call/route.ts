import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { getCachedInstance, getOrFetchEntity } from '@/lib/telegram/utils';
import { telegramManager } from '@/lib/telegram/client';
import { callManager } from '@/lib/telegram/calls/CallManager';

export async function POST(req: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  const requestStartTime = Date.now();
  const timingBreakdown: any = {};

  let authInstanceId = undefined;
  try {
    if (typeof params !== 'undefined') {
      const p = await params;
      authInstanceId = (p as any).instanceId || (p as any).id;
    }
  } catch (e) {}

  if (!(await checkAuth(req, authInstanceId))) return unauthorizedResponse();
  timingBreakdown.authMs = Date.now() - requestStartTime;

  try {
    const { instanceId } = await params;
    const body = await req.json();
    const { chatId, timeoutSeconds = 30, durationSeconds = 5, video = false } = body;

    if (!chatId) {
      return NextResponse.json(
        { error: 'chatId é obrigatório para iniciar uma chamada', code: 'MISSING_CHAT_ID' },
        { status: 400 }
      );
    }

    // ── 1. Validação de Tipo de Instância ──────────────────────────────────────
    const instance = await getCachedInstance(instanceId);
    if (!instance) {
      return NextResponse.json({ error: 'Instância não encontrada', code: 'INSTANCE_NOT_FOUND' }, { status: 404 });
    }

    if (instance.type === 'BOT') {
      return NextResponse.json(
        { 
          error: 'Chamadas não são suportadas em contas do tipo BOT pelo Telegram. Use uma conta pessoal (USER).',
          code: 'BOT_CALLS_UNSUPPORTED' 
        },
        { status: 400 }
      );
    }

    // ── 2. Obtenção do Cliente Telegram e Resolução do Destinatário ───────────
    const tInit = Date.now();
    const client = await telegramManager.getClient(instanceId, instance.session);
    if (!client) {
      return NextResponse.json({ error: 'Cliente Telegram desconectado', code: 'CLIENT_DISCONNECTED' }, { status: 400 });
    }

    const { entity: peerEntity } = await getOrFetchEntity(client, chatId);
    if (!peerEntity) {
      return NextResponse.json({ error: `Destinatário '${chatId}' não encontrado no Telegram`, code: 'PEER_NOT_FOUND' }, { status: 404 });
    }

    // ── 3. Disparo da Chamada via CallManager ──────────────────────────────────
    const callResult = await callManager.initiateCall(
      client,
      instanceId,
      peerEntity,
      chatId.toString(),
      {
        timeoutSeconds: Number(timeoutSeconds) || 30,
        durationSeconds: Number(durationSeconds) || 5,
        video: Boolean(video)
      }
    );
    timingBreakdown.callInitMs = Date.now() - tInit;

    const totalMs = Date.now() - requestStartTime;

    return NextResponse.json({
      success: true,
      callId: callResult.callId,
      status: callResult.status,
      chatId: chatId.toString(),
      durationSeconds: callResult.durationSeconds,
      timeoutSeconds: callResult.timeoutSeconds,
      timingBreakdown: {
        ...timingBreakdown,
        totalMs
      }
    });

  } catch (err: any) {
    console.error('[CallAPI] Erro ao iniciar chamada:', err);

    const errMsg = err?.message || '';

    if (errMsg.includes('USER_PRIVACY_RESTRICTED')) {
      return NextResponse.json(
        {
          error: 'O destinatário restringiu o recebimento de chamadas nas configurações de privacidade do Telegram (permite apenas "Meus Contatos" ou "Ninguém").',
          code: 'USER_PRIVACY_RESTRICTED',
          hint: 'Para que a chamada toque, o destinatário precisa ter o número da instância salvo na agenda/contatos dele, ou alterar em: Configurações > Privacidade e Segurança > Chamadas > "Todos".'
        },
        { status: 403 }
      );
    }

    if (errMsg.includes('CALL_OCCUPIED') || errMsg.includes('USER_ALREADY_CALLING')) {
      return NextResponse.json(
        {
          error: 'O destinatário já está em outra chamada no momento.',
          code: 'CALL_OCCUPIED'
        },
        { status: 409 }
      );
    }

    if (errMsg.includes('USER_IS_BLOCKED')) {
      return NextResponse.json(
        {
          error: 'A conta da instância foi bloqueada pelo destinatário.',
          code: 'USER_IS_BLOCKED'
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: err.message || 'Falha interna ao processar chamada', code: 'CALL_INIT_ERROR' },
      { status: 500 }
    );
  }
}
