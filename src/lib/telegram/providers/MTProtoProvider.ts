import { Instance } from '@prisma/client';
import { ITelegramProvider, MediaOptions, MessageOptions, ViewOnceOptions } from './IProvider';
import { telegramManager } from '../client';
import { simulateTyping, simulateFileAction, normalizeActionName, getTelegramActionClass } from '../actions';
import { getOrFetchEntity, normalizeNewlines } from '../utils';
import { sendViewOnceFile } from '../viewOnce';
import { getWorkerPool } from '../../workers/WorkerPool';
import { Api } from 'telegram';
import { CustomFile } from 'telegram/client/uploads';
import * as mm from 'music-metadata';
import fs from 'fs';
import crypto from 'crypto';

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

    // ── Envio Nativo de Voice Note (Áudios como Gravados / Sem anexo de arquivo) ──
    // Se for voiceNote e o arquivo NÃO for um InputMedia já cacheado do Telegram:
    // Fazemos o upload direto com DocumentAttributeAudio(voice: true) e SEM DocumentAttributeFilename.
    // Isso evita que o Telegram e o GramJS exibam o áudio como um arquivo anexado (.oga/.mp3)
    // e garante a renderização como bolha de voz nativa com waveform e botão play.
    if (options?.voiceNote && !(file && typeof file === 'object' && file.className?.startsWith('InputMedia'))) {
      try {
        let buffer: Buffer;
        if (Buffer.isBuffer(file)) {
          buffer = file;
        } else if (typeof file === 'string' && fs.existsSync(file)) {
          buffer = fs.readFileSync(file);
        } else if (typeof file === 'string' && /^https?:\/\//i.test(file)) {
          const res = await fetch(file, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          if (!res.ok) throw new Error(`Falha ao baixar áudio para voice note: HTTP ${res.status}`);
          buffer = Buffer.from(await res.arrayBuffer());
        } else {
          buffer = Buffer.from(file);
        }

        let durationSeconds = options.duration || 0;
        if (!durationSeconds) {
          try {
            const meta = await mm.parseBuffer(buffer, 'audio/ogg');
            if (meta.format.duration) durationSeconds = Math.round(meta.format.duration);
          } catch (e) {}
        }

        const uniqueId = crypto.randomUUID();
        const customFile = new CustomFile(`voice_${uniqueId}.ogg`, buffer.length, '', buffer);
        const fileHandle = await client.uploadFile({
          file: customFile,
          workers: 1,
        });

        const media = new Api.InputMediaUploadedDocument({
          file: fileHandle,
          mimeType: 'audio/ogg',
          attributes: [
            new Api.DocumentAttributeAudio({
              voice: true,
              duration: Math.max(1, durationSeconds),
            }),
          ],
        });

        let replyObject: any = undefined;
        if (options.replyToMsgId) {
          replyObject = new Api.InputReplyToMessage({
            replyToMsgId: options.replyToMsgId,
          });
        }

        const request = new Api.messages.SendMedia({
          peer,
          media,
          message: options.caption ? normalizeNewlines(options.caption) : '',
          replyTo: replyObject,
        });

        const result: any = await client.invoke(request);
        const msg: any = client._getResponseMessage(request, result, peer);
        return { id: msg?.id || 0, nativeMessage: msg };
      } catch (voiceErr: any) {
        console.error(`[MTProtoProvider] Erro ao enviar voice note nativa:`, voiceErr);
        throw voiceErr;
      }
    }

    try {
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
    } catch (err: any) {
      // Se o Telegram falhar no cURL remoto de uma URL (WEBPAGE_CURL_FAILED):
      if (typeof file === 'string' && /^https?:\/\//i.test(file) && String(err?.message || '').includes('WEBPAGE_CURL_FAILED')) {
        console.warn(`[MTProtoProvider] WEBPAGE_CURL_FAILED detectado para ${file}. Baixando arquivo no servidor e reenviando via buffer upload...`);
        try {
          const res = await fetch(file, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            const msg = await client.sendFile(peer, {
              file: buffer,
              caption: options?.caption ? normalizeNewlines(options.caption) : '',
              forceDocument: options?.forceDocument,
              voiceNote: options?.voiceNote,
              videoNote: false,
              replyTo: options?.replyToMsgId,
              parseMode: options?.parseMode
            });
            console.log(`[MTProtoProvider] Envio via buffer concluído com sucesso após WEBPAGE_CURL_FAILED!`);
            return { id: msg.id, nativeMessage: msg };
          }
        } catch (downloadErr) {
          console.error(`[MTProtoProvider] Falha ao baixar mídia no fallback de WEBPAGE_CURL_FAILED:`, downloadErr);
        }
      }
      throw err;
    }
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
