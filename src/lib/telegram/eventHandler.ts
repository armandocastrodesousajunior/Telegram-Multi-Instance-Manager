import { TelegramClient } from 'telegram';
import { dispatchWebhook } from '../webhooks/dispatcher';
import { Api } from 'telegram';
import { NewMessageEvent } from 'telegram/events/NewMessage';
import { EditedMessageEvent } from 'telegram/events/EditedMessage';

const LOG_PREFIX = '[TG-EventHandler]';

/**
 * Popula proativamente o cache de entidades da GramJS a partir do evento de mensagem.
 * 
 * Estratégia: tentar múltiplos métodos de resolução em cascata, com logs detalhados
 * para diagnóstico em produção.
 */
async function warmEntityFromEvent(client: TelegramClient, event: any, instanceId: string) {
  const message = event.message;
  const chatIdStr = message?.chatId?.toString() ?? 'unknown';
  const senderIdStr = message?.senderId?.toString() ?? 'unknown';
  const isOutgoing = message?.out ?? false;

  console.log(`${LOG_PREFIX} [${instanceId}] Nova mensagem recebida. chatId=${chatIdStr} senderId=${senderIdStr} isOutgoing=${isOutgoing}`);

  if (isOutgoing) {
    console.log(`${LOG_PREFIX} [${instanceId}] Mensagem sainte, pulando warm-up de entidade.`);
    return;
  }

  // ── Passo 1: tentar event.getSender() ─────────────────────────────────────
  console.log(`${LOG_PREFIX} [${instanceId}] Tentativa 1: event.getSender() para sender ${senderIdStr}...`);
  try {
    const sender = await event.getSender();
    if (sender) {
      console.log(`${LOG_PREFIX} [${instanceId}] getSender() OK. className=${sender.className} id=${sender.id} hasAccessHash=${!!sender.accessHash}`);
      try {
        const inputEntity = await client.getInputEntity(sender);
        console.log(`${LOG_PREFIX} [${instanceId}] ✅ Entidade cacheada via getInputEntity(sender): className=${(inputEntity as any)?.className}`);
        return; // Sucesso — sai aqui
      } catch (cacheErr: any) {
        console.warn(`${LOG_PREFIX} [${instanceId}] getInputEntity(sender) falhou: ${cacheErr.message}`);
      }
    } else {
      console.warn(`${LOG_PREFIX} [${instanceId}] getSender() retornou null/undefined.`);
    }
  } catch (senderErr: any) {
    console.warn(`${LOG_PREFIX} [${instanceId}] getSender() lançou exceção: ${senderErr.message}`);
  }

  // ── Passo 2: tentar message.peerId diretamente ───────────────────────────
  if (message?.peerId) {
    const peerClassName = message.peerId?.className ?? 'unknown';
    const peerUserId = message.peerId?.userId?.toString() ?? 'N/A';
    console.log(`${LOG_PREFIX} [${instanceId}] Tentativa 2: getInputEntity(peerId). peerId.className=${peerClassName} userId=${peerUserId}...`);
    try {
      const inputEntity = await client.getInputEntity(message.peerId);
      console.log(`${LOG_PREFIX} [${instanceId}] ✅ Entidade cacheada via getInputEntity(peerId): className=${(inputEntity as any)?.className}`);
      return;
    } catch (peerErr: any) {
      console.warn(`${LOG_PREFIX} [${instanceId}] getInputEntity(peerId) falhou: ${peerErr.message}`);
    }
  }

  // ── Passo 3: recarregar diálogos (contingência final) ────────────────────
  console.log(`${LOG_PREFIX} [${instanceId}] Tentativa 3 (contingência): recarregando 200 diálogos...`);
  try {
    const dialogs = await client.getDialogs({ limit: 200 });
    console.log(`${LOG_PREFIX} [${instanceId}] getDialogs() retornou ${dialogs.length} diálogos. Verificando se chatId ${chatIdStr} está agora no cache...`);
    try {
      if (message?.peerId) {
        const inputEntity = await client.getInputEntity(message.peerId);
        console.log(`${LOG_PREFIX} [${instanceId}] ✅ Entidade encontrada no cache após recarregar diálogos: className=${(inputEntity as any)?.className}`);
      }
    } catch (retryErr: any) {
      console.warn(`${LOG_PREFIX} [${instanceId}] Entidade ainda NÃO encontrada após recarregar diálogos. Erro: ${retryErr.message}`);
      console.warn(`${LOG_PREFIX} [${instanceId}] ⚠️ Isso indica que o lead ${senderIdStr} não apareceu nos últimos 200 diálogos.`);
    }
  } catch (dialogErr: any) {
    console.error(`${LOG_PREFIX} [${instanceId}] Falha ao recarregar diálogos: ${dialogErr.message}`);
  }
}

export async function handleNewMessage(instanceId: string, event: NewMessageEvent, client?: TelegramClient) {
  const message = event.message;
  let type = 'text';
  let mediaUrl = undefined;

  // Pre-warm entity cache com o remetente dessa mensagem
  if (client) {
    await warmEntityFromEvent(client, event, instanceId);
  }

  if (message.media) {
    const ttl = (message.media as any).ttlSeconds;
    const isViewOnce = ttl && ttl > 0;

    if (message.photo) {
      type = isViewOnce ? 'view_once_image' : 'image';
    } else if (message.video) {
      type = isViewOnce ? 'view_once_video' : 'video';
    } else if (message.audio) {
      type = isViewOnce ? 'view_once_audio' : 'audio';
    } else if (message.voice) {
      type = isViewOnce ? 'view_once_voice' : 'voice';
    } else if (message.gif) {
      type = 'gif';
    } else if (message.document) {
      if ((message.document as any).attributes?.some((a: any) => a.className === 'DocumentAttributeSticker')) {
        type = 'sticker';
      } else {
        type = 'document';
      }
    } else {
      type = 'unknown';
    }

    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
    mediaUrl = `${baseUrl}/api/v1/${instanceId}/messages/${message.chatId}/${message.id}/media`;
  }

  await dispatchWebhook(instanceId, 'message', {
    id: message.id,
    type,
    content: message.message || '',
    senderId: message.senderId?.toString(),
    chatId: message.chatId?.toString(),
    date: message.date,
    isOutgoing: message.out,
    mediaUrl,
  });
}

export async function handleEditedMessage(instanceId: string, event: EditedMessageEvent, client?: TelegramClient) {
  const message = event.message;
  let type = 'text';
  let mediaUrl = undefined;

  if (client) {
    await warmEntityFromEvent(client, event, instanceId);
  }

  if (message.media) {
    const ttl = (message.media as any).ttlSeconds;
    const isViewOnce = ttl && ttl > 0;

    if (message.photo) {
      type = isViewOnce ? 'view_once_image' : 'image';
    } else if (message.video) {
      type = isViewOnce ? 'view_once_video' : 'video';
    } else if (message.audio) {
      type = isViewOnce ? 'view_once_audio' : 'audio';
    } else if (message.voice) {
      type = isViewOnce ? 'view_once_voice' : 'voice';
    } else if (message.gif) {
      type = 'gif';
    } else if (message.document) {
      if ((message.document as any).attributes?.some((a: any) => a.className === 'DocumentAttributeSticker')) {
        type = 'sticker';
      } else {
        type = 'document';
      }
    } else {
      type = 'unknown';
    }

    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
    mediaUrl = `${baseUrl}/api/v1/${instanceId}/messages/${message.chatId}/${message.id}/media`;
  }

  await dispatchWebhook(instanceId, 'edited_message', {
    id: message.id,
    type,
    content: message.message || '',
    senderId: message.senderId?.toString(),
    chatId: message.chatId?.toString(),
    date: message.date,
    isOutgoing: message.out,
    mediaUrl,
  });
}

export async function handleRawEvent(instanceId: string, event: Api.TypeUpdate) {
  if (event.className === 'UpdateUserTyping' || event.className === 'UpdateChatUserTyping') {
    await dispatchWebhook(instanceId, 'typing', {
      userId: (event as any).userId?.toString(),
      chatId: (event as any).chatId?.toString() || (event as any).userId?.toString(),
      action: (event as any).action?.className,
    });
  }
}
