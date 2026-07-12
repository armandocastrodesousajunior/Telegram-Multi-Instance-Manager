import { Instance } from '@prisma/client';
import { ITelegramProvider, MediaOptions, MessageOptions, ViewOnceOptions } from './IProvider';
import { prisma } from '../../db';
import fs from 'fs';
import path from 'path';

export class BotApiProvider implements ITelegramProvider {
  private apiUrl: string;

  constructor(private instance: Instance) {
    if (!instance.botToken) throw new Error('Bot token is missing');
    this.apiUrl = `https://api.telegram.org/bot${instance.botToken}`;
  }

  public async callApi(method: string, body: any, isFormData: boolean = false) {
    const options: RequestInit = { method: 'POST' };

    // Inject business_connection_id if applicable
    if (this.instance.botType === 'BUSINESS' && this.instance.businessConnectionId) {
      if (isFormData && body instanceof FormData) {
        body.append('business_connection_id', this.instance.businessConnectionId);
      } else if (!isFormData) {
        body.business_connection_id = this.instance.businessConnectionId;
      }
    }

    if (isFormData) {
      options.body = body;
    } else {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }

    const res = await fetch(`${this.apiUrl}/${method}`, options);
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Telegram Bot API Error: ${data.description}`);
    }
    return data.result;
  }

  public async deleteBotMessage(chatId: string | number, messageId: number) {
    if (this.instance.botType === 'BUSINESS' && this.instance.businessConnectionId) {
      return this.callApi('deleteBusinessMessages', {
        chat_id: chatId,
        message_ids: [messageId]
      });
    } else {
      return this.callApi('deleteMessage', {
        chat_id: chatId,
        message_id: messageId
      });
    }
  }

  async connect(): Promise<void> {
    // For bots, connecting via webhook can happen here, or in a separate flow.
    // We will leave it empty and handle webhook setup elsewhere or here.
  }

  async disconnect(): Promise<void> {
    // Optionally delete webhook
  }

  async sendMessage(chatId: string | number, text: string, options?: MessageOptions) {
    const payload: any = {
      chat_id: chatId,
      text: text,
      reply_parameters: options?.replyToMsgId ? { message_id: options.replyToMsgId } : undefined,
      parse_mode: options?.parseMode === 'html' ? 'HTML' : undefined
    };
    const result = await this.callApi('sendMessage', payload);
    return { id: result.message_id, nativeMessage: result };
  }

  async sendFile(chatId: string | number, file: string | Buffer | any, options?: MediaOptions) {
    let method = 'sendDocument';
    let mediaField = 'document';

    // Best effort mapping based on options or inference
    if (options?.voiceNote) {
      method = 'sendVoice';
      mediaField = 'voice';
    } else if (options?.forceDocument === false) {
      // It's likely photo or video. We can guess by file extension or default to Document.
      // A more robust way would be passed via `mediaType`, but we'll try to infer if it's string
      if (typeof file === 'string') {
        const lower = file.toLowerCase();
        if (lower.match(/\.(jpg|jpeg|png|gif)$/)) {
          method = 'sendPhoto'; mediaField = 'photo';
        } else if (lower.match(/\.(mp4|mov|avi)$/)) {
          method = 'sendVideo'; mediaField = 'video';
        } else if (lower.match(/\.(ogg|opus)$/)) {
          method = 'sendVoice'; mediaField = 'voice';
        }
      }
    }

    const payload: any = {
      chat_id: chatId,
      caption: options?.caption || '',
      reply_parameters: options?.replyToMsgId ? { message_id: options.replyToMsgId } : undefined,
      parse_mode: options?.parseMode === 'html' ? 'HTML' : undefined
    };

    let isFormData = false;
    let body: any;

    if (typeof file === 'string' && (file.startsWith('http') || file.match(/^[a-zA-Z0-9_-]+$/))) {
      // URL or File ID
      payload[mediaField] = file;
      body = payload;
    } else {
      // File buffer or path
      isFormData = true;
      body = new FormData();
      Object.keys(payload).forEach(k => {
        if (payload[k] !== undefined) body.append(k, typeof payload[k] === 'object' ? JSON.stringify(payload[k]) : payload[k]);
      });
      
      let blob: Blob;
      let filename = 'file';
      if (typeof file === 'string' && fs.existsSync(file)) {
        const buffer = fs.readFileSync(file);
        blob = new Blob([new Uint8Array(buffer)]);
        filename = path.basename(file);
      } else if (Buffer.isBuffer(file)) {
        blob = new Blob([new Uint8Array(file)]);
      } else {
        blob = new Blob([file as any]); // fallback
      }
      body.append(mediaField, blob, filename);
    }

    const result = await this.callApi(method, body, isFormData);
    return { id: result.message_id, nativeMessage: result };
  }

  async sendViewOnceFile(chatId: string | number, file: string | Buffer | any, mediaType: 'photo' | 'video', options?: ViewOnceOptions) {
    // Bot API doesn't support View Once in regular chats.
    // Fallback: Send normally, then delete after ttlSeconds
    const method = mediaType === 'photo' ? 'sendPhoto' : 'sendVideo';
    const mediaField = mediaType;

    const payload: any = {
      chat_id: chatId,
      caption: options?.caption || '',
      reply_parameters: options?.replyToMsgId ? { message_id: options.replyToMsgId } : undefined,
      parse_mode: options?.parseMode === 'html' ? 'HTML' : undefined
    };

    let isFormData = false;
    let body: any;

    if (typeof file === 'string' && (file.startsWith('http') || file.match(/^[a-zA-Z0-9_-]+$/))) {
      payload[mediaField] = file;
      body = payload;
    } else {
      isFormData = true;
      body = new FormData();
      Object.keys(payload).forEach(k => {
        if (payload[k] !== undefined) body.append(k, typeof payload[k] === 'object' ? JSON.stringify(payload[k]) : payload[k]);
      });
      
      let blob: Blob;
      let filename = mediaType === 'photo' ? 'image.jpg' : 'video.mp4';
      if (typeof file === 'string' && fs.existsSync(file)) {
        const buffer = fs.readFileSync(file);
        blob = new Blob([new Uint8Array(buffer)]);
        filename = path.basename(file);
      } else if (Buffer.isBuffer(file)) {
        blob = new Blob([new Uint8Array(file)]);
      } else {
        blob = new Blob([file as any]);
      }
      body.append(mediaField, blob, filename);
    }

    const result = await this.callApi(method, body, isFormData);
    const msgId = result.message_id;

    // View Once Fallback mechanism (Delete after TTL or Config)
    const settings = await prisma.instanceSettings.findUnique({
      where: { instanceId: this.instance.id }
    });

    const mode = settings?.botSelfDestructMode || 'AFTER_SEND';
    const timer = settings?.botSelfDestructTimer || 60;

    if (mode === 'AFTER_SEND') {
      const waitTime = timer > 0 ? timer : 60;
      setTimeout(async () => {
        try {
          await this.deleteBotMessage(chatId, msgId);
          console.log(`[BotApiProvider] Fallback View Once: Deleted message ${msgId} after ${waitTime}s`);
        } catch (e) {
          console.error(`[BotApiProvider] Fallback View Once Failed to delete message ${msgId}:`, e);
        }
      }, waitTime * 1000);
    } else if (mode === 'AFTER_REPLY') {
      try {
        await prisma.pendingDestruction.create({
          data: {
            instanceId: this.instance.id,
            chatId: String(chatId),
            messageId: msgId
          }
        });
        console.log(`[BotApiProvider] Queued message ${msgId} for destruction AFTER_REPLY in chat ${chatId}`);
      } catch (e) {
        console.error(`[BotApiProvider] Failed to queue destruction:`, e);
      }
    }

    return { id: msgId, nativeMessage: result };
  }

  async simulateTyping(chatId: string | number, durationMs?: number): Promise<void> {
    const settings = await prisma.instanceSettings.findUnique({ where: { instanceId: this.instance.id } });
    if (!settings || !settings.typingEnabled) return;

    let duration = durationMs || ((settings.typingFixedSeconds || 5) * 1000);
    duration = Math.min(duration, 30000);

    if (duration > 0) {
      // Telegram bot actions last for 5 seconds or until a message is sent.
      try {
        await this.callApi('sendChatAction', { chat_id: chatId, action: 'typing' });
        // We could loop, but for simplicity we sleep
        await new Promise(r => setTimeout(r, Math.min(duration, 5000)));
      } catch (e) {}
    }
  }

  async simulateFileAction(chatId: string | number, action: 'document' | 'photo' | 'video' | 'audio', durationMs?: number): Promise<void> {
    const settings = await prisma.instanceSettings.findUnique({ where: { instanceId: this.instance.id } });
    if (!settings) return;

    let botAction = '';
    let duration = durationMs || 2000;
    
    if (action === 'audio' && settings.audioActionEnabled) {
      botAction = 'record_voice';
    } else if (action === 'video' && settings.videoActionEnabled) {
      botAction = 'record_video';
    } else if (action === 'photo' && settings.photoActionEnabled) {
      botAction = 'upload_photo';
    } else if (action === 'document' && settings.documentActionEnabled) {
      botAction = 'upload_document';
    }

    if (botAction) {
      try {
        await this.callApi('sendChatAction', { chat_id: chatId, action: botAction });
        await new Promise(r => setTimeout(r, Math.min(duration, 5000)));
      } catch (e) {}
    }
  }
}
