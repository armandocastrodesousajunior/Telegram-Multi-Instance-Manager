import { Instance } from '@prisma/client';
import { ITelegramProvider } from './IProvider';
import { MTProtoProvider } from './MTProtoProvider';
import { BotApiProvider } from './BotApiProvider';

export class ProviderFactory {
  private static providers: Map<string, ITelegramProvider> = new Map();

  static async getProvider(instance: Instance): Promise<ITelegramProvider> {
    const existing = this.providers.get(instance.id);
    if (existing) {
      return existing;
    }

    let provider: ITelegramProvider;

    if (instance.type === 'BOT') {
      if (!instance.botToken) {
        throw new Error('Bot token is missing for this instance.');
      }
      provider = new BotApiProvider(instance);
    } else {
      provider = new MTProtoProvider(instance);
    }

    // Tenta conectar se necessário
    await provider.connect();

    this.providers.set(instance.id, provider);
    return provider;
  }

  static async removeProvider(instanceId: string) {
    const provider = this.providers.get(instanceId);
    if (provider) {
      await provider.disconnect();
      this.providers.delete(instanceId);
    }
  }

  static hasProvider(instanceId: string): boolean {
    return this.providers.has(instanceId);
  }
}
