import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { prisma } from '../db';
import { handleNewMessage, handleEditedMessage, handleRawEvent } from './eventHandler';
import { NewMessage } from 'telegram/events/NewMessage';
import { EditedMessage } from 'telegram/events/EditedMessage';
import { Raw } from 'telegram/events/Raw';
import { LogLevel } from 'telegram/extensions/Logger';

const apiId = parseInt(process.env.TELEGRAM_API_ID || '0', 10);
const apiHash = process.env.TELEGRAM_API_HASH || '';

export class TelegramClientManager {
  private clients: Map<string, TelegramClient> = new Map();

  async getClient(instanceId: string, sessionStr?: string): Promise<TelegramClient> {
    if (this.clients.has(instanceId)) {
      return this.clients.get(instanceId)!;
    }

    if (!sessionStr) {
       const instance = await prisma.instance.findUnique({ where: { id: instanceId } });
       if (!instance) throw new Error("Instance not found");
       sessionStr = instance.session || '';
    }

    const session = new StringSession(sessionStr);
    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
    });
    client.setLogLevel(LogLevel.ERROR);

    // Passar o client para os handlers para que possam popular o cache de entidades
    client.addEventHandler((event) => handleNewMessage(instanceId, event, client), new NewMessage({}));
    client.addEventHandler((event) => handleEditedMessage(instanceId, event, client), new EditedMessage({}));
    client.addEventHandler((event) => handleRawEvent(instanceId, event, client), new Raw({}));

    try {
      await client.connect();
      // Pre-warm entity cache de forma não-bloqueante em background
      client.getDialogs({ limit: 200 }).catch(() => {});
    } catch (err) {
      console.error(`Failed to connect client ${instanceId}:`, err);
      throw err;
    }

    this.clients.set(instanceId, client);
    return client;
  }

  async removeClient(instanceId: string) {
    const client = this.clients.get(instanceId);
    if (client) {
      try {
        await client.disconnect();
      } catch (e) {}
      this.clients.delete(instanceId);
    }
  }

  hasClient(instanceId: string) {
    return this.clients.has(instanceId);
  }

  /**
   * Consulta em tempo real se o cliente MTProto está vivo e autenticado nos servidores do Telegram.
   */
  async checkClientStatus(instanceId: string, sessionStr?: string | null): Promise<'connected' | 'disconnected'> {
    try {
      if (this.clients.has(instanceId)) {
        const client = this.clients.get(instanceId)!;
        if (!client.connected) {
          try {
            await Promise.race([
              client.connect(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Connect timeout')), 2500))
            ]);
          } catch {
            return 'disconnected';
          }
        }

        const isAuth = await Promise.race([
          client.isUserAuthorized(),
          new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 2500))
        ]);

        if (isAuth) {
          return 'connected';
        } else {
          await this.removeClient(instanceId);
          return 'disconnected';
        }
      }

      if (!sessionStr || !sessionStr.trim()) {
        return 'disconnected';
      }

      const client = await Promise.race([
        this.getClient(instanceId, sessionStr),
        new Promise<TelegramClient>((_, reject) => setTimeout(() => reject(new Error('GetClient timeout')), 3500))
      ]);

      if (!client.connected) {
        return 'disconnected';
      }

      const isAuth = await Promise.race([
        client.isUserAuthorized(),
        new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 2500))
      ]);

      if (isAuth) {
        return 'connected';
      } else {
        await this.removeClient(instanceId);
        return 'disconnected';
      }
    } catch (err: any) {
      console.warn(`[TelegramClientManager] checkClientStatus para ${instanceId}:`, err?.message);
      return 'disconnected';
    }
  }

  async reconnectAll() {
    try {
      const instances = await prisma.instance.findMany({
        where: {
          type: 'USER',
          session: { not: null }
        }
      });

      await Promise.allSettled(
        instances.map(async (instance) => {
          if (instance.session) {
            try {
              const client = await this.getClient(instance.id, instance.session);
              const isAuth = await client.isUserAuthorized();
              const newStatus = isAuth ? 'connected' : 'disconnected';
              await prisma.instance.update({
                where: { id: instance.id },
                data: { status: newStatus }
              });
            } catch (e: any) {
              console.warn(`[reconnectAll] Falha ao reconectar ${instance.name || instance.id}:`, e?.message);
              await prisma.instance.update({
                where: { id: instance.id },
                data: { status: 'disconnected' }
              });
            }
          }
        })
      );
    } catch (err: any) {
      console.error("[reconnectAll] Erro:", err?.message);
    }
  }
}

const globalForManager = globalThis as unknown as { telegramManager: TelegramClientManager };
export const telegramManager = globalForManager.telegramManager || new TelegramClientManager();
if (process.env.NODE_ENV !== 'production') globalForManager.telegramManager = telegramManager;
