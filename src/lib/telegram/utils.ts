import { TelegramClient } from 'telegram';
import { prisma } from '../db';

const LOG_PREFIX = '[TG-EntityResolver]';

// ── Cache em Memória RAM para InstanceSettings e Instance (TTL: 30s) ────────
const settingsCache = new Map<string, { data: any; expiresAt: number }>();
const instanceCache = new Map<string, { data: any; expiresAt: number }>();

export async function getCachedInstanceSettings(instanceId: string): Promise<any> {
  const now = Date.now();
  const cached = settingsCache.get(instanceId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }
  const settings = await prisma.instanceSettings.findUnique({ where: { instanceId } });
  if (settings) {
    settingsCache.set(instanceId, { data: settings, expiresAt: now + 30000 }); // 30s TTL
  }
  return settings;
}

export async function getCachedInstance(instanceId: string): Promise<any> {
  const now = Date.now();
  const cached = instanceCache.get(instanceId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }
  const instance = await prisma.instance.findUnique({ where: { id: instanceId } });
  if (instance) {
    instanceCache.set(instanceId, { data: instance, expiresAt: now + 30000 }); // 30s TTL
  }
  return instance;
}

export function invalidateInstanceSettingsCache(instanceId: string) {
  settingsCache.delete(instanceId);
  instanceCache.delete(instanceId);
}

// ── Cache em Memória RAM (Camada 0) para Entidades / Peers (TTL: 1h) ────────
const clientPeerCache = new WeakMap<TelegramClient, Map<string, { entity: any; expiresAt: number }>>();

function getPeerCacheMap(client: TelegramClient) {
  let map = clientPeerCache.get(client);
  if (!map) {
    map = new Map();
    clientPeerCache.set(client, map);
  }
  return map;
}

export function invalidatePeerCache(client: TelegramClient, chatId?: string | number) {
  const map = clientPeerCache.get(client);
  if (map) {
    if (chatId) map.delete(chatId.toString());
    else map.clear();
  }
}

/**
 * Converte um chatId recebido via JSON (string) para BigInt se for numérico.
 */
export function parseChatId(chatId: string | number): bigint | string {
  if (typeof chatId === 'number') return BigInt(chatId);
  if (typeof chatId === 'string' && /^-?\d+$/.test(chatId.trim())) {
    return BigInt(chatId.trim());
  }
  return chatId;
}


export interface PeerResolution {
  layerHit: 0 | 1 | 2 | 3;
  layerName: 'RAM Cache' | 'GramJS Cache' | 'Telegram API' | 'Dialogs Reload';
  resolveMs: number;
}

/**
 * Resolve a entidade de um chatId com 4 camadas de fallback.
 * Retorna a entidade + telemetria de qual camada foi usada e quanto tempo levou.
 *
 * Camada 0: RAM Cache local do JS (instantâneo, < 0.01ms, sem travar GramJS)
 * Camada 1: getInputEntity() — cache interno da GramJS
 * Camada 2: getEntity()      — busca via API do Telegram (online, ~200ms)
 * Camada 3: getDialogs(200) + getInputEntity() — recarga completa do cache
 */
export async function getOrFetchEntity(client: TelegramClient, chatId: string | number): Promise<{ entity: any; resolution: PeerResolution }> {
  const parsed = parseChatId(chatId);
  const parsedType = typeof parsed === 'bigint' ? 'BigInt' : 'string';
  const key = chatId.toString();
  const now = Date.now();
  const map = getPeerCacheMap(client);

  // ── Camada 0: Cache na memória RAM do JS ──────────────────────────────────
  const cached = map.get(key);
  if (cached && cached.expiresAt > now) {
    return {
      entity: cached.entity,
      resolution: { layerHit: 0, layerName: 'RAM Cache', resolveMs: 0 }
    };
  }

  console.log(`${LOG_PREFIX} Resolvendo chatId=${chatId} (tipo=${parsedType}, valor=${parsed.toString()})`);

  // ── Camada 1: cache local GramJS ──────────────────────────────────────────
  const t1 = Date.now();
  try {
    const entity = await client.getInputEntity(parsed as any);
    const resolveMs = Date.now() - t1;
    console.log(`${LOG_PREFIX} ✅ [Camada 1 - GramJS Cache] chatId=${chatId} resolvido em ${resolveMs}ms`);
    map.set(key, { entity, expiresAt: now + 3600000 }); // Salva na RAM por 1h
    return { entity, resolution: { layerHit: 1, layerName: 'GramJS Cache', resolveMs } };
  } catch (err1: any) {
    const isEntityErr = err1.message?.includes('Could not find the input entity') || err1.message?.includes('No entity found');
    console.warn(`${LOG_PREFIX} ⚠️ [Camada 1 - GramJS Cache] Falhou para chatId=${chatId} em ${Date.now() - t1}ms. Erro: ${err1.message}`);
    if (!isEntityErr) throw err1;
  }

  // ── Camada 2: getEntity() (API online) ───────────────────────────────────
  console.log(`${LOG_PREFIX} [Camada 2 - Telegram API] Chamando getEntity(${parsed.toString()})...`);
  const t2 = Date.now();
  try {
    const entity = await client.getEntity(parsed as any);
    const resolveMs = Date.now() - t2;
    console.log(`${LOG_PREFIX} ✅ [Camada 2 - Telegram API] chatId=${chatId} resolvido em ${resolveMs}ms`);
    map.set(key, { entity, expiresAt: now + 3600000 });
    return { entity, resolution: { layerHit: 2, layerName: 'Telegram API', resolveMs } };
  } catch (err2: any) {
    const isEntityErr = err2.message?.includes('Could not find the input entity') || err2.message?.includes('No entity found');
    console.warn(`${LOG_PREFIX} ⚠️ [Camada 2 - Telegram API] Falhou para chatId=${chatId} em ${Date.now() - t2}ms. Erro: ${err2.message}`);
    if (!isEntityErr) throw err2;
  }

  // ── Camada 3: getDialogs(200) + retry ────────────────────────────────────
  console.log(`${LOG_PREFIX} [Camada 3 - Dialogs Reload] Recarregando 200 diálogos para resolver chatId=${chatId}...`);
  const t3 = Date.now();
  try {
    const dialogs = await client.getDialogs({ limit: 200 });
    console.log(`${LOG_PREFIX} [Camada 3] getDialogs() retornou ${dialogs.length} diálogos. Tentando getInputEntity novamente...`);
    const entity = await client.getInputEntity(parsed as any);
    const resolveMs = Date.now() - t3;
    console.log(`${LOG_PREFIX} ✅ [Camada 3 - Dialogs Reload] chatId=${chatId} resolvido em ${resolveMs}ms após recarregar diálogos`);
    map.set(key, { entity, expiresAt: now + 3600000 });
    return { entity, resolution: { layerHit: 3, layerName: 'Dialogs Reload', resolveMs } };
  } catch (err3: any) {
    console.error(`${LOG_PREFIX} ❌ [Camada 3 - Dialogs Reload] FALHA TOTAL para chatId=${chatId} em ${Date.now() - t3}ms. Erro: ${err3.message}`);
    console.error(`${LOG_PREFIX} ❌ Diagnóstico: o usuário ${chatId} não está nos últimos 200 diálogos e não foi encontrado na API.`);
    console.error(`${LOG_PREFIX} ❌ Verifique se o chatId está correto e se o número de telefone já iniciou uma conversa com esta instância.`);
    throw err3;
  }
}

