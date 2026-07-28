import { TelegramClient } from 'telegram';
import { prisma } from '../db';

const LOG_PREFIX = '[TG-EntityResolver]';

// ── Cache em Memória RAM para InstanceSettings (TTL: 30s) ───────────────────
const settingsCache = new Map<string, { data: any; expiresAt: number }>();

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

export function invalidateInstanceSettingsCache(instanceId: string) {
  settingsCache.delete(instanceId);
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

/**
 * Resolve a entidade de um chatId com 4 camadas de fallback, com logs detalhados.
 *
 * Camada 0: RAM Cache local do JS (instantâneo, < 0.01ms, sem travar GramJS)
 * Camada 1: getInputEntity() — cache interno da GramJS
 * Camada 2: getEntity()      — busca via API do Telegram (online, ~200ms)
 * Camada 3: getDialogs(200) + getInputEntity() — recarga completa do cache
 */
export async function getOrFetchEntity(client: TelegramClient, chatId: string | number): Promise<any> {
  const parsed = parseChatId(chatId);
  const parsedType = typeof parsed === 'bigint' ? 'BigInt' : 'string';
  const key = chatId.toString();
  const now = Date.now();
  const map = getPeerCacheMap(client);

  // ── Camada 0: Cache na memória RAM do JS ──────────────────────────────────
  const cached = map.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.entity;
  }

  console.log(`${LOG_PREFIX} Resolvendo chatId=${chatId} (tipo=${parsedType}, valor=${parsed.toString()})`);

  // ── Camada 1: cache local GramJS ──────────────────────────────────────────
  try {
    const entity = await client.getInputEntity(parsed as any);
    console.log(`${LOG_PREFIX} ✅ [Camada 1 - Cache] chatId=${chatId} resolvido: className=${(entity as any)?.className}`);
    map.set(key, { entity, expiresAt: now + 3600000 }); // Salva na RAM por 1h
    return entity;
  } catch (err1: any) {
    const isEntityErr = err1.message?.includes('Could not find the input entity') || err1.message?.includes('No entity found');
    console.warn(`${LOG_PREFIX} ⚠️ [Camada 1 - Cache] Falhou para chatId=${chatId}. isEntityError=${isEntityErr}. Erro: ${err1.message}`);
    if (!isEntityErr) throw err1; // Erro diferente — propaga imediatamente
  }

  // ── Camada 2: getEntity() (API online) ───────────────────────────────────
  console.log(`${LOG_PREFIX} [Camada 2 - API] Chamando getEntity(${parsed.toString()})...`);
  try {
    const entity = await client.getEntity(parsed as any);
    console.log(`${LOG_PREFIX} ✅ [Camada 2 - API] chatId=${chatId} resolvido: className=${(entity as any)?.className} id=${(entity as any)?.id}`);
    map.set(key, { entity, expiresAt: now + 3600000 });
    return entity;
  } catch (err2: any) {
    const isEntityErr = err2.message?.includes('Could not find the input entity') || err2.message?.includes('No entity found');
    console.warn(`${LOG_PREFIX} ⚠️ [Camada 2 - API] Falhou para chatId=${chatId}. isEntityError=${isEntityErr}. Erro: ${err2.message}`);
    if (!isEntityErr) throw err2;
  }

  // ── Camada 3: getDialogs(200) + retry ────────────────────────────────────
  console.log(`${LOG_PREFIX} [Camada 3 - Contingência] Recarregando 200 diálogos para resolver chatId=${chatId}...`);
  console.log(`${LOG_PREFIX} [Camada 3] ATENÇÃO: Esta camada simula o efeito do restart do servidor.`);
  try {
    const dialogs = await client.getDialogs({ limit: 200 });
    console.log(`${LOG_PREFIX} [Camada 3] getDialogs() retornou ${dialogs.length} diálogos. Tentando getInputEntity novamente...`);

    const entity = await client.getInputEntity(parsed as any);
    console.log(`${LOG_PREFIX} ✅ [Camada 3 - Contingência] chatId=${chatId} resolvido após recarregar diálogos: className=${(entity as any)?.className}`);
    map.set(key, { entity, expiresAt: now + 3600000 });
    return entity;
  } catch (err3: any) {
    console.error(`${LOG_PREFIX} ❌ [Camada 3 - Contingência] FALHA TOTAL para chatId=${chatId}. Erro: ${err3.message}`);
    console.error(`${LOG_PREFIX} ❌ Diagnóstico: o usuário ${chatId} não está nos últimos 200 diálogos e não foi encontrado na API.`);
    console.error(`${LOG_PREFIX} ❌ Verifique se o chatId está correto e se o número de telefone já iniciou uma conversa com esta instância.`);
    throw err3;
  }
}

