import { telegramManager } from './client';
import { cacheManager } from '../cache';
import { prisma } from '../db';

/**
 * Consulta em tempo real o status de uma instância de Bot diretamente na API do Telegram (BotFather/Bot API).
 * Executa getMe com timeout curto para garantir alta performance.
 */
export async function checkBotLiveStatus(botToken?: string | null): Promise<'connected' | 'disconnected'> {
  if (!botToken || !botToken.trim()) return 'disconnected';

  try {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getMe`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutTimer);

    if (!res.ok) return 'disconnected';

    const data = await res.json().catch(() => null);
    if (data && data.ok === true) {
      return 'connected';
    }
    return 'disconnected';
  } catch (err) {
    return 'disconnected';
  }
}

/**
 * Consulta em tempo real o status de uma instância pessoal (MTProto / GramJS).
 * Verifica se o socket está conectado e se a sessão está autenticada nos servidores do Telegram.
 */
export async function checkUserLiveStatus(instanceId: string, sessionStr?: string | null): Promise<'connected' | 'disconnected'> {
  return telegramManager.checkClientStatus(instanceId, sessionStr);
}

export interface InstanceStatusCheckTarget {
  id: string;
  type: string;
  botToken?: string | null;
  session?: string | null;
  status?: string;
  [key: string]: any;
}

/**
 * Retorna o status real (ao vivo) da instância consultando a API do Telegram.
 * 
 * - BOT: Consulta Telegram Bot API (getMe).
 * - USER: Consulta GramJS / MTProto (isUserAuthorized e estado do socket).
 * - Utiliza cache de curta duração (10s) para evitar sobrecarga em múltiplos acessos simultâneos.
 * - Sincroniza o banco de dados em segundo plano caso o status salvo esteja desatualizado.
 */
export async function getInstanceLiveStatus(
  instance: InstanceStatusCheckTarget,
  forceRefresh: boolean = false
): Promise<'connected' | 'disconnected'> {
  const cacheKey = `tg:live_status:${instance.id}`;

  if (!forceRefresh) {
    const cached = await cacheManager.get<'connected' | 'disconnected'>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  let liveStatus: 'connected' | 'disconnected' = 'disconnected';

  try {
    if (instance.type === 'BOT') {
      liveStatus = await checkBotLiveStatus(instance.botToken);
    } else {
      liveStatus = await checkUserLiveStatus(instance.id, instance.session);
    }
  } catch (err) {
    console.warn(`[StatusCheck] Erro ao verificar status da instância ${instance.id}:`, err);
    liveStatus = 'disconnected';
  }

  // Cacheia o resultado por 10 segundos
  await cacheManager.set(cacheKey, liveStatus, 10);

  // Se o status no banco estiver diferente do status real, atualiza o banco em background
  if (instance.status && instance.status !== liveStatus) {
    prisma.instance.update({
      where: { id: instance.id },
      data: { status: liveStatus }
    }).catch(() => {});
  }

  return liveStatus;
}

/**
 * Invalida o cache de status ao vivo para uma instância (usado após connect, disconnect, login, etc.)
 */
export async function invalidateInstanceStatusCache(instanceId: string): Promise<void> {
  await cacheManager.delete(`tg:live_status:${instanceId}`);
}
