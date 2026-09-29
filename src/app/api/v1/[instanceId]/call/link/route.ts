import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { getCachedInstance, getOrFetchEntity } from '@/lib/telegram/utils';
import { telegramManager } from '@/lib/telegram/client';
import { callManager } from '@/lib/telegram/calls/CallManager';
import * as mm from 'music-metadata';

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
    const { chatId, url, timeoutSeconds = 60, hangupOnVideoEnd = true, messageText } = body;

    if (!chatId || !url) {
      return NextResponse.json(
        { error: 'chatId e url são obrigatórios para iniciar uma chamada via link', code: 'MISSING_PARAMETERS' },
        { status: 400 }
      );
    }

    const instance = await getCachedInstance(instanceId);
    if (!instance) {
      return NextResponse.json({ error: 'Instância não encontrada', code: 'INSTANCE_NOT_FOUND' }, { status: 404 });
    }

    if (instance.type === 'BOT') {
      return NextResponse.json(
        { 
          error: 'Chamadas via link não são suportadas em instâncias do tipo BOT pelo Telegram. Conecte uma conta pessoal nativa (USER).',
          code: 'BOT_CALLS_UNSUPPORTED' 
        },
        { status: 400 }
      );
    }

    // ── Download do Vídeo e Extração de Duração Real ──────────────────────────
    const tDl = Date.now();
    let videoDurationSeconds = 30; // fallback padrão

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Falha ao carregar vídeo: HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      try {
        const metadata = await mm.parseBuffer(buffer, res.headers.get('content-type') || 'video/mp4');
        if (metadata.format?.duration) {
          videoDurationSeconds = Math.max(1, Math.round(metadata.format.duration));
        }
      } catch (metaErr) {
        console.warn('[CallLinkAPI] Não foi possível ler metadados do vídeo, usando fallback:', metaErr);
      }
    } catch (dlErr: any) {
      return NextResponse.json(
        { error: `Erro ao baixar vídeo para a chamada: ${dlErr.message}`, code: 'VIDEO_DOWNLOAD_FAILED' },
        { status: 400 }
      );
    }
    timingBreakdown.mediaDownloadMs = Date.now() - tDl;

    // ── Obtenção do Cliente Telegram e Resolução do Peer ──────────────────────
    const tInit = Date.now();
    const client = await telegramManager.getClient(instanceId, instance.session);
    if (!client) {
      return NextResponse.json({ error: 'Cliente Telegram desconectado', code: 'CLIENT_DISCONNECTED' }, { status: 400 });
    }

    const { entity: peerEntity } = await getOrFetchEntity(client, chatId);
    if (!peerEntity) {
      return NextResponse.json({ error: `Destinatário '${chatId}' não encontrado no Telegram`, code: 'PEER_NOT_FOUND' }, { status: 404 });
    }

    // ── Disparo da Chamada de Vídeo via Link Oficial ──────────────────────────
    const callResult = await callManager.initiateCallViaLink(
      client,
      instanceId,
      peerEntity,
      chatId.toString(),
      url,
      videoDurationSeconds,
      {
        timeoutSeconds: Number(timeoutSeconds) || 60,
        hangupOnVideoEnd: Boolean(hangupOnVideoEnd),
        messageText
      }
    );
    timingBreakdown.callInitMs = Date.now() - tInit;

    const totalMs = Date.now() - requestStartTime;

    return NextResponse.json({
      success: true,
      callId: callResult.callId,
      link: callResult.link,
      status: callResult.status,
      chatId: chatId.toString(),
      videoDurationSeconds: callResult.videoDurationSeconds,
      timeoutSeconds: Number(timeoutSeconds) || 60,
      hangupOnVideoEnd: Boolean(hangupOnVideoEnd),
      timingBreakdown: {
        ...timingBreakdown,
        totalMs
      }
    });

  } catch (err: any) {
    console.error('[CallLinkAPI] Erro ao iniciar chamada via link:', err);
    return NextResponse.json(
      { error: err.message || 'Falha interna ao gerar chamada via link', code: 'CALL_LINK_ERROR' },
      { status: 500 }
    );
  }
}
