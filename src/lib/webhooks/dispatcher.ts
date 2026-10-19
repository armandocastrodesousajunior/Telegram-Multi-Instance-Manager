import { logWebhookEvent } from '../logger';
import { getCachedWebhooks, getCachedInstance } from '../telegram/utils';

interface WebhookDispatchOptions {
  maxRetries?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
}

function getWebhookConfig(): Required<WebhookDispatchOptions> {
  const maxRetries = Math.max(1, parseInt(process.env.WEBHOOK_MAX_RETRIES || '3', 10));
  const timeoutMs = Math.max(1000, parseInt(process.env.WEBHOOK_TIMEOUT_MS || '15000', 10));
  const baseDelayMs = Math.max(500, parseInt(process.env.WEBHOOK_RETRY_DELAY_MS || '2000', 10));
  return { maxRetries, timeoutMs, baseDelayMs };
}

/**
 * Envia um webhook individual com suporte a Timeout e Fila de Retentativa com Backoff Exponencial.
 * Executado de forma assíncrona (não-bloqueante) para não travar o loop de eventos do Telegram.
 */
async function dispatchSingleWebhookWithRetry(
  webhook: any,
  payloadStr: string,
  eventName: string,
  instanceId: string,
  normalizedData: any
) {
  const { maxRetries, timeoutMs, baseDelayMs } = getWebhookConfig();

  let lastStatus = 0;
  let lastResponseBody: any = null;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'HotTelegram-WebhookDispatcher/2.0'
        },
        body: payloadStr,
        signal: controller.signal
      });

      clearTimeout(timeoutTimer);
      lastStatus = response.status;

      try {
        lastResponseBody = await response.json();
      } catch (e) {
        // Resposta não é JSON, tenta texto curto
        try {
          const text = await response.text();
          if (text) lastResponseBody = { message: text.substring(0, 500) };
        } catch {}
      }

      // Sucesso (HTTP 2xx)
      if (response.ok) {
        await logWebhookEvent({
          instanceId,
          webhookId: webhook.id,
          event: eventName,
          targetUrl: webhook.url,
          requestPayload: { event: eventName, instanceId, data: normalizedData },
          responseStatus: response.status,
          responseBody: lastResponseBody,
          success: true
        });
        return;
      }

      // Se for erro de cliente definitivo (ex: 400 Bad Request, 401, 404, 422), não retenta
      // Apenas retenta se for 408 (Request Timeout), 429 (Rate Limit) ou 5xx (Erro no servidor de destino)
      const isRetryableStatus = response.status === 408 || response.status === 429 || (response.status >= 500 && response.status <= 599);
      if (!isRetryableStatus) {
        lastError = new Error(`HTTP ${response.status}`);
        break;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      lastError = err;
      lastStatus = err?.name === 'AbortError' ? 408 : 500;
      lastResponseBody = { error: err.message, name: err?.name };
    }

    // Se ainda restarem tentativas de retry:
    if (attempt < maxRetries) {
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1); // 2s, 4s, 8s...
      console.warn(`[WebhookDispatcher] ⚠️ Falha ao despachar webhook para ${webhook.url} (tentativa ${attempt}/${maxRetries}): ${lastError?.message}. Retentando em ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Falha definitiva após esgotar todas as tentativas
  console.error(`[WebhookDispatcher] ❌ Falha definitiva no webhook ${webhook.url} após ${maxRetries} tentativas:`, lastError?.message);
  await logWebhookEvent({
    instanceId,
    webhookId: webhook.id,
    event: eventName,
    targetUrl: webhook.url,
    requestPayload: { event: eventName, instanceId, data: normalizedData },
    responseStatus: lastStatus || 500,
    responseBody: lastResponseBody || { error: lastError?.message || 'Falha no envio de webhook após múltiplas tentativas' },
    success: false
  });
}

/**
 * Despacha eventos para os webhooks ativos configurados para a instância.
 * Utiliza Cache em Memória RAM ou Redis (Zero Dependência do PostgreSQL a cada mensagem).
 */
export async function dispatchWebhook(instanceId: string, eventName: string, payload: any) {
  try {
    // 1. Busca webhooks e dados da instância do CACHE (Memória ou Redis)
    // ZERO consultas ao PostgreSQL durante o tráfego contínuo de mensagens!
    const [webhooks, instanceObj] = await Promise.all([
      getCachedWebhooks(instanceId),
      getCachedInstance(instanceId)
    ]);

    if (!webhooks || webhooks.length === 0) {
      return;
    }

    const endpoint = process.env.PUBLIC_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Normalização defensiva: garante que o campo 'phone' esteja sempre presente no objeto 'data'
    const normalizedData = (typeof payload === 'object' && payload !== null)
      ? { ...payload, phone: payload.phone !== undefined ? payload.phone : '' }
      : payload;

    for (const webhook of webhooks) {
      let events: string[] = [];
      try {
        events = typeof webhook.events === 'string' ? JSON.parse(webhook.events) : webhook.events;
      } catch (e) {
        continue;
      }

      if (events.includes(eventName) || events.includes('*')) {
        // Filtra mensagens saintes se o webhook tiver includeOutgoing = false
        if (!webhook.includeOutgoing && payload?.isOutgoing) {
          continue;
        }

        const payloadStr = JSON.stringify({
          event: eventName,
          instanceId,
          instanceName: instanceObj?.name || '',
          language: (instanceObj as any)?.language || 'pt-BR',
          data: normalizedData,
          connection: {
            endpoint: endpoint,
            token: instanceObj?.token || ''
          }
        });

        // Dispara com retentativa e backoff de forma assíncrona (não-bloqueante)
        dispatchSingleWebhookWithRetry(webhook, payloadStr, eventName, instanceId, normalizedData).catch((dispatchErr) => {
          console.error(`[WebhookDispatcher] Exceção não tratada no dispatch de ${webhook.url}:`, dispatchErr);
        });
      }
    }
  } catch (err: any) {
    console.error(`[WebhookDispatcher] Erro crítico ao recuperar webhooks para ${instanceId}:`, err);
    // Registra log para que o erro nunca fique invisível no painel
    await logWebhookEvent({
      instanceId,
      event: eventName,
      targetUrl: 'N/A',
      requestPayload: { event: eventName, instanceId, data: payload },
      responseStatus: 500,
      responseBody: { error: `Erro interno no despacho do webhook: ${err.message}` },
      success: false
    });
  }
}
