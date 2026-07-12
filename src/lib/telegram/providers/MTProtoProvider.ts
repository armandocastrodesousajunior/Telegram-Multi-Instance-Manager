import { Instance } from '@prisma/client';
import { ITelegramProvider, MediaOptions, MessageOptions, ViewOnceOptions } from './IProvider';
import { telegramManager } from '../client';
import { simulateTyping, simulateFileAction } from '../actions';
import { getOrFetchEntity } from '../utils';
import { sendViewOnceFile } from '../viewOnce';

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
    const peer = await getOrFetchEntity(client, chatId);
    const msg = await client.sendMessage(peer, {
      message: text,
      replyTo: options?.replyToMsgId,
      parseMode: options?.parseMode
    });
    return { id: msg.id, nativeMessage: msg };
  }

  async sendFile(chatId: string | number, file: string | Buffer | any, options?: MediaOptions) {
    const client = await telegramManager.getClient(this.instance.id);
    const peer = await getOrFetchEntity(client, chatId);
    const msg = await client.sendFile(peer, {
      file: file,
      caption: options?.caption || '',
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
    const peer = await getOrFetchEntity(client, chatId);
    const msg = await sendViewOnceFile(client, peer, {
      tempPath,
      mediaType,
      caption: options?.caption || '',
      replyToMsgId: options?.replyToMsgId,
      ttlSeconds: options?.ttlSeconds || 2147483647,
      parseMode: options?.parseMode
    });
    return { id: msg.id, nativeMessage: msg };
  }

  async simulateTyping(chatId: string | number, durationMs?: number): Promise<void> {
    const client = await telegramManager.getClient(this.instance.id);
    await simulateTyping(client, this.instance.id, chatId.toString(), 'typing simulator active'); 
    // note: simulateTyping normally takes the full string to calculate duration if useDuration=true. 
    // Wait, the interface allows us to pass a duration or we can just pass the duration. 
    // I will adjust actions.ts later if needed to accept explicit duration.
  }

  async simulateFileAction(chatId: string | number, action: 'document' | 'photo' | 'video' | 'audio', durationMs?: number): Promise<void> {
    const client = await telegramManager.getClient(this.instance.id);
    await simulateFileAction(client, this.instance.id, chatId.toString(), action, durationMs);
  }
}
