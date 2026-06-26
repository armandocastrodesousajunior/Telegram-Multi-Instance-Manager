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

    client.addEventHandler((event) => handleNewMessage(instanceId, event), new NewMessage({}));
    client.addEventHandler((event) => handleEditedMessage(instanceId, event), new EditedMessage({}));
    client.addEventHandler((event) => handleRawEvent(instanceId, event), new Raw({}));

    try {
      await client.connect();
      // Pre-warm entity cache to avoid "Could not find the input entity" errors on restart
      try {
        await client.getDialogs({ limit: 200 });
      } catch (cacheErr) {
        console.error("Failed to warm entity cache:", cacheErr);
      }
    } catch (err) {
      console.error("Failed to connect client:", err);
    }

    this.clients.set(instanceId, client);
    return client;
  }

  async removeClient(instanceId: string) {
    const client = this.clients.get(instanceId);
    if (client) {
      await client.disconnect();
      this.clients.delete(instanceId);
    }
  }

  hasClient(instanceId: string) {
    return this.clients.has(instanceId);
  }

  async reconnectAll() {
    const instances = await prisma.instance.findMany({
      where: { status: 'connected' }
    });
    for (const instance of instances) {
      if (instance.session) {
        try {
          await this.getClient(instance.id, instance.session);
        } catch (e) {
          console.error(`Failed to reconnect instance ${instance.id}`, e);
        }
      }
    }
  }
}

const globalForManager = globalThis as unknown as { telegramManager: TelegramClientManager };
export const telegramManager = globalForManager.telegramManager || new TelegramClientManager();
if (process.env.NODE_ENV !== 'production') globalForManager.telegramManager = telegramManager;
