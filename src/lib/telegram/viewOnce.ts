import { TelegramClient } from 'telegram';
import { Api } from 'telegram';
import { CustomFile } from 'telegram/client/uploads';
import { generateRandomBigInt } from 'telegram/Helpers';
import fs from 'fs';
import path from 'path';

export interface ViewOnceOptions {
  tempPath: string;                // Caminho local do arquivo já baixado
  mediaType: 'photo' | 'video';   // Tipo de mídia
  caption?: string;
  replyToMsgId?: number;
  ttlSeconds: number;              // Duração configurada na instância
  parseMode?: string;
}

/**
 * Envia mídia como "view once" usando a API de baixo nível do GramJS.
 *
 * POR QUÊ não usamos client.invoke patching (abordagem anterior):
 * O monkey-patching de client.invoke é um singleton compartilhado entre todas
 * as requisições concorrentes. Se duas requisições chegam ao mesmo tempo — uma
 * view-once e outra normal — a segunda captura o invoke já patchado como seu
 * "original" e ao fazer restore no finally, deixa o invoke patchado ativo
 * permanentemente. Isso fazia TODAS as mídias subsequentes serem enviadas como
 * view-once, mesmo sem a flag.
 *
 * A solução: construir o payload de SendMedia diretamente, com ttlSeconds já
 * embutido, sem precisar interceptar o invoke globalmente.
 */
export async function sendViewOnceFile(
  client: TelegramClient,
  resolvedPeer: any,
  options: ViewOnceOptions
): Promise<{ id: number }> {
  const { tempPath, mediaType, caption, replyToMsgId, ttlSeconds } = options;

  if (!fs.existsSync(tempPath)) {
    throw new Error(`[ViewOnce] Arquivo temporário não encontrado: ${tempPath}`);
  }

  const fileName = path.basename(tempPath);
  const fileSize = fs.statSync(tempPath).size;

  console.log(`[ViewOnce] Fazendo upload de ${fileName} (${fileSize} bytes, ttlSeconds=${ttlSeconds})...`);

  // Faz upload do arquivo para os servidores do Telegram
  const toUpload = new CustomFile(fileName, fileSize, tempPath);
  const uploadedFile = await client.uploadFile({
    file: toUpload as any,
    workers: 4,
  });

  console.log(`[ViewOnce] Upload concluído. Construindo InputMedia com ttlSeconds=${ttlSeconds}...`);

  // Constrói o InputMedia com ttlSeconds diretamente — sem tocar em client.invoke
  let inputMedia: Api.TypeInputMedia;

  if (mediaType === 'photo') {
    inputMedia = new Api.InputMediaUploadedPhoto({
      file: uploadedFile,
      ttlSeconds: ttlSeconds,
    });
  } else {
    const ext = path.extname(tempPath).toLowerCase();
    const mimeType = ext === '.mov' ? 'video/quicktime'
      : ext === '.avi' ? 'video/avi'
      : ext === '.webm' ? 'video/webm'
      : 'video/mp4';

    inputMedia = new Api.InputMediaUploadedDocument({
      file: uploadedFile,
      mimeType: mimeType,
      attributes: [
        new Api.DocumentAttributeFilename({ fileName }),
        new Api.DocumentAttributeVideo({
          duration: 0,
          w: 0,
          h: 0,
          supportsStreaming: true,
        }),
      ],
      ttlSeconds: ttlSeconds,
    });
  }

  // Monta e envia o SendMedia diretamente
  const result: any = await client.invoke(new Api.messages.SendMedia({
    peer: resolvedPeer,
    media: inputMedia,
    message: caption || '',
    randomId: generateRandomBigInt(),
    ...(replyToMsgId ? {
      replyTo: new Api.InputReplyToMessage({ replyToMsgId }),
    } : {}),
  }));

  // Extrai o ID da mensagem do resultado (TypeUpdates)
  const msgId = extractMessageId(result);
  console.log(`[ViewOnce] Mídia view-once enviada com sucesso. messageId=${msgId}`);
  return { id: msgId };
}

function extractMessageId(result: any): number {
  if (!result) return 0;

  // UpdateShortSentMessage — resposta simplificada do Telegram
  if (result.className === 'UpdateShortSentMessage') {
    return result.id ?? 0;
  }

  // Updates — caso mais comum (DMs, grupos)
  if (Array.isArray(result.updates)) {
    const msgUpdate = result.updates.find((u: any) =>
      u.className === 'UpdateNewMessage' ||
      u.className === 'UpdateNewChannelMessage'
    );
    return msgUpdate?.message?.id ?? 0;
  }

  return 0;
}
