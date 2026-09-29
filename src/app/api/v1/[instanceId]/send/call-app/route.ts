import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { getCachedInstance, getOrFetchEntity } from '@/lib/telegram/utils';
import { ProviderFactory } from '@/lib/telegram/providers/ProviderFactory';

let cachedBotUsername: string | null = null;

async function getBotUsername(token: string): Promise<string | null> {
  if (cachedBotUsername) return cachedBotUsername;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data: any = await res.json();
    if (data.ok && data.result?.username) {
      cachedBotUsername = data.result.username;
      return cachedBotUsername;
    }
  } catch (e) {
    console.warn('[CallAppAPI] Não foi possível obter o username do bot via getMe:', e);
  }
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  const requestStartTime = Date.now();

  let authInstanceId = undefined;
  try {
    if (typeof params !== 'undefined') {
      const p = await params;
      authInstanceId = (p as any).instanceId || (p as any).id;
    }
  } catch (e) {}

  if (!(await checkAuth(req, authInstanceId))) return unauthorizedResponse();

  try {
    const { instanceId } = await params;
    const body = await req.json();
    const {
      chatId,
      videoUrl,
      text = "Oi amor! Minha conexão falhou aqui na chamada 🙈 Clica no botão abaixo para entrar na nossa chamada de vídeo privada:",
      buttonText = "📹 Entrar na Chamada de Vídeo",
      callerName,
      replyToMsgId
    } = body;

    if (!chatId || !videoUrl) {
      return NextResponse.json(
        { error: 'chatId e videoUrl são obrigatórios para enviar o convite de chamada', code: 'MISSING_PARAMETERS' },
        { status: 400 }
      );
    }

    const instance = await getCachedInstance(instanceId);
    if (!instance) {
      return NextResponse.json({ error: 'Instância não encontrada', code: 'INSTANCE_NOT_FOUND' }, { status: 404 });
    }

    const displayName = callerName || instance.name || 'Chamada Privada';
    const publicUrl = process.env.PUBLIC_URL || 'https://telegram-multi-instance-manager-production.up.railway.app';
    const webAppUrl = `${publicUrl}/call-player?video=${encodeURIComponent(videoUrl)}&name=${encodeURIComponent(displayName)}`;

    const botToken = process.env.MINIAPP_BOT_TOKEN;
    let botUsername = (process.env.MINIAPP_BOT_USERNAME || '').replace('@', '').trim();
    if (!botUsername && botToken) {
      const resolved = await getBotUsername(botToken);
      if (resolved) botUsername = resolved;
    }
    const shortName = (process.env.MINIAPP_SHORT_NAME || '').trim();

    let tmeLink = webAppUrl;
    if (botUsername) {
      try {
        const startParam = Buffer.from(JSON.stringify({ video: videoUrl, name: displayName })).toString('base64url');
        if (shortName) {
          tmeLink = `https://t.me/${botUsername}/${shortName}?startapp=${startParam}`;
        } else {
          tmeLink = `https://t.me/${botUsername}?startapp=${startParam}`;
        }
      } catch (e) {
        tmeLink = shortName ? `https://t.me/${botUsername}/${shortName}` : `https://t.me/${botUsername}`;
      }
    }

    let sentVia = 'instance';
    let messageId: any = null;

    // ── 1. Tentativa de envio via Bot Oficial (Inline Keyboard WebApp) ──────────
    if (botToken) {
      try {
        const botRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId.toString(),
            text: text,
            reply_to_message_id: replyToMsgId || undefined,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: buttonText,
                    web_app: { url: webAppUrl }
                  }
                ]
              ]
            }
          })
        });

        const botData: any = await botRes.json();
        if (botData.ok) {
          sentVia = 'bot';
          messageId = botData.result?.message_id;
        } else {
          console.warn('[CallAppAPI] Envio via Bot falhou (ex: lead não iniciou bot), fazendo fallback para Conta Pessoal:', botData.description);
        }
      } catch (botErr: any) {
        console.warn('[CallAppAPI] Erro ao contactar Bot API:', botErr.message);
      }
    }

    // ── 2. Envio via Conta Pessoal (USER) da Instância (Fallback Garantido) ───
    if (!messageId) {
      const provider = await ProviderFactory.getProvider(instance);
      const formattedMessage = `${text}\n\n👉 [ ${buttonText} ](${tmeLink})`;

      const result = await provider.sendMessage(chatId, formattedMessage, {
        parseMode: 'md',
        replyToMsgId
      });

      messageId = result.id;
      sentVia = 'instance';
    }

    const totalMs = Date.now() - requestStartTime;

    return NextResponse.json({
      success: true,
      messageId,
      sentVia,
      chatId: chatId.toString(),
      webAppUrl,
      tmeLink,
      durationMs: totalMs
    });

  } catch (err: any) {
    console.error('[CallAppAPI] Erro ao enviar convite do Mini App:', err);
    return NextResponse.json(
      { error: err.message || 'Falha interna ao processar envio do Mini App', code: 'SEND_CALL_APP_ERROR' },
      { status: 500 }
    );
  }
}
