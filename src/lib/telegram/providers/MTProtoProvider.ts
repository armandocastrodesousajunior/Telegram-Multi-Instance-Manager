import { Instance } from '@prisma/client';
import { ITelegramProvider, MediaOptions, MessageOptions, ViewOnceOptions } from './IProvider';
import { telegramManager } from '../client';
import { simulateTyping, simulateFileAction, normalizeActionName, getTelegramActionClass } from '../actions';
import { getOrFetchEntity, normalizeNewlines } from '../utils';
import { sendViewOnceFile } from '../viewOnce';
import { getWorkerPool } from '../../workers/WorkerPool';
import { Api } from 'telegram';

export class MTProtoProvider implements ITelegramProvider {
  constructor(private instance: Instance) {}

  async connect(): Promise<void> {
    await telegramManager.getClient(this.instance.id);
  }

  async disconnect(): Promise<void> {
    await telegramManager.removeClient(this.instance.id);
  }

  async sendMessage(chatId: string | number, text: string, options?: MessageOptions) {
    const client = await telegramManager.getClient(this.instance.id);
    const { entity: peer } = await getOrFetchEntity(client, chatId);
    const msg = await client.sendMessage(peer, {
      message: normalizeNewlines(text),
      replyTo: options?.replyToMsgId,
      parseMode: options?.parseMode
    });
    return { id: msg.id, nativeMessage: msg };
  }

  async sendFile(chatId: string | number, file: string | Buffer | any, options?: MediaOptions) {
    const client = await telegramManager.getClient(this.instance.id);
    const { entity: peer } = await getOrFetchEntity(client, chatId);
    const msg = await client.sendFile(peer, {
      file: file,
      caption: options?.caption ? normalizeNewlines(options.caption) : '',
      forceDocument: options?.forceDocument,
      voiceNote: options?.voiceNote,
      videoNote: false,
      replyTo: options?.replyToMsgId,
      parseMode: options?.parseMode
    });
    return { id: msg.id, nativeMessage: msg };
  }

  async sendViewOnceFile(chatId: string | number, tempPath: string, mediaType: 'photo' | 'video', options?: ViewOnceOptions) {
    const client = await telegramManager.getClient(this.instance.id);
    const { entity: peer } = await getOrFetchEntity(client, chatId);
    const msg = await sendViewOnceFile(client, peer, {
      tempPath,
      mediaType,
      caption: options?.caption ? normalizeNewlines(options.caption) : '',
      replyToMsgId: options?.replyToMsgId,
      ttlSeconds: options?.ttlSeconds || 2147483647,
      parseMode: options?.parseMode
    });
    return { id: msg.id, nativeMessage: msg };
  }

  async simulateTyping(chatId: string | number, textOrDuration?: string | number) {
    const client = await telegramManager.getClient(this.instance.id);
    return simulateTyping(client, this.instance.id, chatId.toString(), textOrDuration);
  }

  async simulateFileAction(chatId: string | number, action: 'document' | 'photo' | 'video' | 'audio', durationMs?: number) {
    const client = await telegramManager.getClient(this.instance.id);
    return simulateFileAction(client, this.instance.id, chatId.toString(), action, durationMs);
  }

  async sendChatAction(chatId: string | number, action: string) {
    const client = await telegramManager.getClient(this.instance.id);
    const { entity: peer, resolution: peerResolution } = await getOrFetchEntity(client, chatId);
    const normalized = normalizeActionName(action);
    const telegramAction = getTelegramActionClass(normalized);

    const tStart = Date.now();
    await client.invoke(new Api.messages.SetTyping({ peer, action: telegramAction }));
    return { success: true, action: normalized, durationMs: Date.now() - tStart, peerResolution };
  }

  async sendChatActionLoop(chatId: string | number, action: string, durationSeconds: number = 10, wait: boolean = false) {
    const client = await telegramManager.getClient(this.instance.id);
    const { entity: peer, resolution: peerResolution } = await getOrFetchEntity(client, chatId);
    const normalized = normalizeActionName(action);
    const telegramAction = getTelegramActionClass(normalized);

    const isCancel = normalized === 'cancel';
    if (isCancel) {
      const tStart = Date.now();
      await client.invoke(new Api.messages.SetTyping({ peer, action: telegramAction }));
      return { success: true, action: normalized, durationMs: Date.now() - tStart, peerResolution };
    }

    const duration = Math.min(Math.max(durationSeconds || 1, 1) * 1000, 60000);

    if (wait) {
      const { simulationMs } = await getWorkerPool().runSimulation(
        duration,
        () => {
          client.invoke(new Api.messages.SetTyping({ peer, action: telegramAction })).catch(() => {});
        }
      );
      return { success: true, action: normalized, durationMs: simulationMs, peerResolution };
    } else {
      getWorkerPool().runSimulation(
        duration,
        () => {
          client.invoke(new Api.messages.SetTyping({ peer, action: telegramAction })).catch(() => {});
        }
      ).catch(() => {});
      return { success: true, action: normalized, durationMs: duration, peerResolution };
    }
  }
}
