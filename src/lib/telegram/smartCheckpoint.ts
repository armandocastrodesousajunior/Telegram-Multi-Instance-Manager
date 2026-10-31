import crypto from 'crypto';
import { cacheManager } from '../cache';

export interface SmartActionProgress {
  completed: boolean;
  messageId?: number;
}

export interface SmartCheckpoint {
  status: 'in_progress' | 'completed';
  createdAt: number;
  updatedAt: number;
  actions: Record<number, SmartActionProgress>;
  messageIds: number[];
}

// ── In-Flight Mutex: Evita que requisições simultâneas (ex: timeout do cliente HTTP)
// executem loops concorrentes de envio para a mesma mensagem.
const inFlightSmartMap = new Map<string, Promise<any>>();

export function getInFlightSmartRequest(key: string): Promise<any> | undefined {
  return inFlightSmartMap.get(key);
}

export function setInFlightSmartRequest(key: string, promise: Promise<any>): void {
  inFlightSmartMap.set(key, promise);
}

export function removeInFlightSmartRequest(key: string): void {
  inFlightSmartMap.delete(key);
}

// TTL de 5 minutos (300s): tempo ideal para absorver retries automáticos de sistemas externos
// sem poluir memória ou Redis.
const CHECKPOINT_TTL_SECONDS = 300;

/**
 * Gera uma chave de idempotência determinística e compacta.
 * Se o cliente enviar customKey (header ou body), respeita.
 * Caso contrário, computa um hash SHA-256 ultra-rápido de instanceId + chatId + content.
 */
export function generateSmartIdempotencyKey(
  instanceId: string,
  chatId: string | number,
  content: string,
  customKey?: string | null
): string {
  if (customKey && customKey.trim()) {
    return `tg:smart_chk:${instanceId}:${customKey.trim()}`;
  }

  const hash = crypto
    .createHash('sha256')
    .update(`${instanceId}:${chatId}:${content.trim()}`)
    .digest('hex')
    .substring(0, 32); // 128-bit collision resistance, chave compacta

  return `tg:smart_chk:${instanceId}:${chatId}:${hash}`;
}

/**
 * Recupera o checkpoint atual se existir no Cache (RAM/Redis).
 */
export async function getSmartCheckpoint(key: string): Promise<SmartCheckpoint | null> {
  return cacheManager.get<SmartCheckpoint>(key);
}

/**
 * Inicializa ou obtém o checkpoint no Cache.
 */
export async function initOrGetSmartCheckpoint(key: string): Promise<SmartCheckpoint> {
  const existing = await cacheManager.get<SmartCheckpoint>(key);
  if (existing) return existing;

  const newCheckpoint: SmartCheckpoint = {
    status: 'in_progress',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    actions: {},
    messageIds: []
  };

  await cacheManager.set(key, newCheckpoint, CHECKPOINT_TTL_SECONDS);
  return newCheckpoint;
}

/**
 * Registra o sucesso de uma ação individual logo após o Telegram confirmar a entrega.
 * Isso garante que mesmo se a próxima ação falhar ou der timeout, esta nunca será duplicada.
 */
export async function recordActionSuccess(
  key: string,
  checkpoint: SmartCheckpoint,
  actionIndex: number,
  messageId: number
): Promise<void> {
  checkpoint.actions[actionIndex] = {
    completed: true,
    messageId
  };

  if (!checkpoint.messageIds.includes(messageId)) {
    checkpoint.messageIds.push(messageId);
  }

  checkpoint.updatedAt = Date.now();
  await cacheManager.set(key, checkpoint, CHECKPOINT_TTL_SECONDS);
}

/**
 * Marca a sequência completa do SmartRoute como 100% entregue.
 */
export async function finalizeSmartCheckpoint(
  key: string,
  checkpoint: SmartCheckpoint
): Promise<void> {
  checkpoint.status = 'completed';
  checkpoint.updatedAt = Date.now();
  await cacheManager.set(key, checkpoint, CHECKPOINT_TTL_SECONDS);
}
