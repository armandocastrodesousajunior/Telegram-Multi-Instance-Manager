import { prisma } from '@/lib/db';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { cacheManager } from '../cache';

interface CachedMediaData {
  mediaType: string;
  mediaId: string;
  accessHash: string;
  fileReference: string;
  durationMs: number;
}

function buildInputMedia(cached: CachedMediaData): { media: Api.TypeInputMedia, durationMs: number } {
  const id = bigInt(cached.mediaId);
  const accessHash = bigInt(cached.accessHash);
  const fileReference = Buffer.from(cached.fileReference, 'hex');

  if (cached.mediaType === 'photo') {
    return {
      media: new Api.InputMediaPhoto({
        id: new Api.InputPhoto({
          id,
          accessHash,
          fileReference
        })
      }),
      durationMs: cached.durationMs
    };
  } else {
    return {
      media: new Api.InputMediaDocument({
        id: new Api.InputDocument({
          id,
          accessHash,
          fileReference
        })
      }),
      durationMs: cached.durationMs
    };
  }
}

/**
 * Retorna o objeto InputMedia do GramJS usando os dados cacheados (Memória/Redis primeiro, Prisma depois).
 */
export async function getCachedMedia(instanceId: string, url: string): Promise<{ media: Api.TypeInputMedia, durationMs: number } | null> {
  const cacheKey = `tg:media:${instanceId}:${url}`;

  try {
    // 1. Tenta recuperar do Cache Rápido (RAM ou Redis)
    const fastCached = await cacheManager.get<CachedMediaData>(cacheKey);
    if (fastCached) {
      return buildInputMedia(fastCached);
    }

    // 2. Fallback para o Banco PostgreSQL
    const cached = await prisma.mediaCache.findUnique({
      where: { instanceId_url: { instanceId, url } }
    });

    if (!cached) return null;

    // Se estiver expirado no banco, deleta e retorna null
    if (cached.expiresAt < new Date()) {
      await prisma.mediaCache.delete({ where: { id: cached.id } }).catch(() => {});
      return null;
    }

    const mediaData: CachedMediaData = {
      mediaType: cached.mediaType,
      mediaId: cached.mediaId,
      accessHash: cached.accessHash,
      fileReference: cached.fileReference,
      durationMs: cached.durationMs
    };

    // Salva no Cache rápido pelo tempo restante ou padrão 24h (86400s)
    const remainingSeconds = Math.max(60, Math.floor((cached.expiresAt.getTime() - Date.now()) / 1000));
    await cacheManager.set(cacheKey, mediaData, remainingSeconds);

    return buildInputMedia(mediaData);
  } catch (error) {
    console.error('[MediaCache] Erro ao recuperar mídia do cache:', error);
    return null;
  }
}

/**
 * Salva as referências (fileId) de um documento/foto recém enviado no Cache (RAM/Redis + PostgreSQL).
 */
export async function saveMediaToCache(instanceId: string, url: string, message: any, durationMs: number = 0) {
  try {
    if (!message || !message.media) return;

    let mediaType = '';
    let mediaId = '';
    let accessHash = '';
    let fileReference = '';

    if (message.media.className === 'MessageMediaPhoto' && message.media.photo) {
      mediaType = 'photo';
      mediaId = message.media.photo.id.toString();
      accessHash = message.media.photo.accessHash.toString();
      fileReference = Buffer.from(message.media.photo.fileReference).toString('hex');
    } else if (message.media.className === 'MessageMediaDocument' && message.media.document) {
      mediaType = 'document';
      mediaId = message.media.document.id.toString();
      accessHash = message.media.document.accessHash.toString();
      fileReference = Buffer.from(message.media.document.fileReference).toString('hex');
    } else {
      return; // Tipo não suportado
    }

    const mediaData: CachedMediaData = {
      mediaType,
      mediaId,
      accessHash,
      fileReference,
      durationMs
    };

    // Grava imediatamente no cache rápido (RAM/Redis) por 24h
    const cacheKey = `tg:media:${instanceId}:${url}`;
    await cacheManager.set(cacheKey, mediaData, 86400);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.mediaCache.upsert({
      where: { instanceId_url: { instanceId, url } },
      update: {
        mediaType,
        mediaId,
        accessHash,
        fileReference,
        durationMs,
        expiresAt
      },
      create: {
        instanceId,
        url,
        mediaType,
        mediaId,
        accessHash,
        fileReference,
        durationMs,
        expiresAt
      }
    });
    
    console.log(`[MediaCache] Mídia salva no cache com sucesso: ${url}`);
  } catch (err) {
    console.error('[MediaCache] Erro ao salvar mídia no cache:', err);
  }
}
