import Redis from 'ioredis';

interface CacheEntry {
  data: any;
  expiresAt: number;
}

export class CacheManager {
  private driver: 'memory' | 'redis' = 'memory';
  private memoryCache: Map<string, CacheEntry> = new Map();
  private redisClient: Redis | null = null;
  private isRedisReady: boolean = false;

  constructor() {
    const configuredDriver = (process.env.CACHE_DRIVER || 'memory').toLowerCase().trim();
    const redisUrl = process.env.REDIS_URL;

    if (configuredDriver === 'redis' && redisUrl) {
      this.initRedis(redisUrl);
    } else {
      this.driver = 'memory';
      console.log(`[CacheManager] Usando driver de cache: MEMORY (RAM local)`);
    }
  }

  private initRedis(url: string) {
    try {
      this.driver = 'redis';
      this.redisClient = new Redis(url, {
        maxRetriesPerRequest: 2,
        connectTimeout: 5000,
        lazyConnect: false,
        retryStrategy(times) {
          if (times > 5) {
            console.warn(`[CacheManager] Falha ao reconectar ao Redis após 5 tentativas. Alternando para memória.`);
            return null; // para de tentar reconectar indefinidamente
          }
          return Math.min(times * 1000, 3000);
        }
      });

      this.redisClient.on('connect', () => {
        this.isRedisReady = true;
        console.log(`[CacheManager] ✅ Conectado com sucesso ao REDIS (${url.replace(/:\/\/[^@]+@/, '://***@')})`);
      });

      this.redisClient.on('ready', () => {
        this.isRedisReady = true;
      });

      this.redisClient.on('error', (err) => {
        console.warn(`[CacheManager] ⚠️ Erro de conexão no Redis: ${err.message}. Fallback para memória ativado.`);
        this.isRedisReady = false;
      });

      this.redisClient.on('close', () => {
        this.isRedisReady = false;
      });
    } catch (err: any) {
      console.error(`[CacheManager] Falha ao inicializar cliente Redis: ${err.message}. Usando memória.`);
      this.driver = 'memory';
      this.isRedisReady = false;
    }
  }

  public getDriverName(): 'memory' | 'redis' {
    return this.driver === 'redis' && this.isRedisReady ? 'redis' : 'memory';
  }

  public async get<T>(key: string): Promise<T | null> {
    // 1. Tenta obter do Redis se estiver configurado e saudável
    if (this.driver === 'redis' && this.redisClient && this.isRedisReady) {
      try {
        const raw = await this.redisClient.get(key);
        if (raw !== null) {
          return JSON.parse(raw) as T;
        }
        return null;
      } catch (err: any) {
        console.warn(`[CacheManager] Erro ao ler chave "${key}" do Redis: ${err.message}. Lendo da memória.`);
      }
    }

    // 2. Fallback / Leitura em Memória RAM
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (entry.expiresAt > 0 && entry.expiresAt < Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  public async set(key: string, value: any, ttlSeconds: number = 60): Promise<void> {
    // 1. Grava no Redis se ativo
    if (this.driver === 'redis' && this.redisClient && this.isRedisReady) {
      try {
        const serialized = JSON.stringify(value);
        if (ttlSeconds > 0) {
          await this.redisClient.set(key, serialized, 'EX', ttlSeconds);
        } else {
          await this.redisClient.set(key, serialized);
        }
      } catch (err: any) {
        console.warn(`[CacheManager] Erro ao gravar chave "${key}" no Redis: ${err.message}. Salvando na memória.`);
      }
    }

    // 2. Sempre grava na memória local para consistência e velocidade
    const expiresAt = ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : 0;
    this.memoryCache.set(key, { data: value, expiresAt });
  }

  public async delete(key: string): Promise<void> {
    // 1. Deleta do Redis se ativo
    if (this.driver === 'redis' && this.redisClient && this.isRedisReady) {
      try {
        await this.redisClient.del(key);
      } catch (err: any) {
        console.warn(`[CacheManager] Erro ao deletar chave "${key}" do Redis: ${err.message}`);
      }
    }

    // 2. Deleta da memória RAM
    this.memoryCache.delete(key);
  }

  public async deletePrefix(prefix: string): Promise<void> {
    // 1. Deleta do Redis se ativo
    if (this.driver === 'redis' && this.redisClient && this.isRedisReady) {
      try {
        const keys = await this.redisClient.keys(`${prefix}*`);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } catch (err: any) {
        console.warn(`[CacheManager] Erro ao deletar prefixo "${prefix}" do Redis: ${err.message}`);
      }
    }

    // 2. Deleta da memória RAM
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }
  }
}

// Singleton no globalThis para reaproveitamento entre todos os módulos do Next.js
const globalForCache = globalThis as unknown as { cacheManager: CacheManager };
export const cacheManager = globalForCache.cacheManager || new CacheManager();
globalForCache.cacheManager = cacheManager;
