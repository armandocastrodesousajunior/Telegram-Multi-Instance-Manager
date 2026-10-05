import { TelegramClient } from 'telegram';
import { dispatchWebhook } from '../webhooks/dispatcher';
import { Api } from 'telegram';
import { NewMessageEvent } from 'telegram/events/NewMessage';
import { EditedMessageEvent } from 'telegram/events/EditedMessage';
import { callManager } from './calls/CallManager';

const LOG_PREFIX = '[TG-EventHandler]';

/**
 * Popula proativamente o cache de entidades da GramJS a partir do evento de mensagem.
 * 
 * Estratégia: tentar múltiplos métodos de resolução em cascata, com logs detalhados
 * para diagnóstico em produção. Retorna a entidade de remetente caso resolvida.
 */
async function warmEntityFromEvent(client: TelegramClient, event: any, instanceId: string): Promise<any> {
  const message = event.message;
  const chatIdStr = message?.chatId?.toString() ?? 'unknown';
  const senderIdStr = message?.senderId?.toString() ?? 'unknown';
  const isOutgoing = message?.out ?? false;

  console.log(`${LOG_PREFIX} [${instanceId}] Nova mensagem recebida. chatId=${chatIdStr} senderId=${senderIdStr} isOutgoing=${isOutgoing}`);

  if (isOutgoing) {
    console.log(`${LOG_PREFIX} [${instanceId}] Mensagem sainte, pulando warm-up de entidade.`);
    return null;
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
        return sender;
      } catch (cacheErr: any) {
        console.warn(`${LOG_PREFIX} [${instanceId}] getInputEntity(sender) falhou: ${cacheErr.message}`);
        return sender;
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
      try {
        return await client.getEntity(message.peerId);
      } catch {}
      return null;
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
        return await client.getEntity(message.peerId);
      }
    } catch (retryErr: any) {
      console.warn(`${LOG_PREFIX} [${instanceId}] Entidade ainda NÃO encontrada após recarregar diálogos. Erro: ${retryErr.message}`);
      console.warn(`${LOG_PREFIX} [${instanceId}] ⚠️ Isso indica que o lead ${senderIdStr} não apareceu nos últimos 200 diálogos.`);
    }
  } catch (dialogErr: any) {
    console.error(`${LOG_PREFIX} [${instanceId}] Falha ao recarregar diálogos: ${dialogErr.message}`);
  }
  return null;
}

/**
 * Normaliza e formata o número de telefone no formato internacional (+...).
 * Retorna string vazia caso não haja número disponível.
 */
export function formatPhoneNumber(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  const cleaned = rawPhone.toString().trim().replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

/**
 * Extrai o número de telefone do usuário a partir dos dados do evento MTProto (GramJS).
 * Se o usuário tiver o número visível nas configurações de privacidade do Telegram,
 * ele é retornado devidamente formatado. Caso esteja oculto, retorna string vazia "".
 */
export async function extractPhoneFromEvent(
  event: any,
  senderEntity?: any,
  client?: TelegramClient
): Promise<string> {
  try {
    // 1. Telefone direto da entidade de remetente já resolvida
    if (senderEntity?.phone) {
      return formatPhoneNumber(senderEntity.phone);
    }

    // 2. Se a mensagem contém uma mídia de contato compartilhado (MessageMediaContact)
    const media = event?.message?.media;
    if (media?.phoneNumber) {
      return formatPhoneNumber(media.phoneNumber);
    }

    // 3. Tentar obter sender via event.getSender()
    if (typeof event?.getSender === 'function') {
      try {
        const sender = await event.getSender();
        if (sender?.phone) {
          return formatPhoneNumber(sender.phone);
        }
      } catch (e) {
        // Ignora erro
      }
    }

    // 4. Se a mensagem for sainte (isOutgoing = true) em conversa privada,
    // tentar buscar o telefone do destinatário (chatId / peerId)
    const message = event?.message;
    if (message?.out && client && message?.peerId) {
      try {
        const peer: any = await client.getEntity(message.peerId);
        if (peer?.phone) {
          return formatPhoneNumber(peer.phone);
        }
      } catch (e) {
        // Ignora erro
      }
    }

    // 5. Tentar obter via client.getEntity usando senderId
    if (client && message?.senderId) {
      try {
        const entity: any = await client.getEntity(message.senderId);
        if (entity?.phone) {
          return formatPhoneNumber(entity.phone);
        }
      } catch (e) {
        // Ignora erro
      }
    }

    // 6. Tentar obter via client.getEntity usando chatId se for peer de usuário
    if (client && message?.chatId) {
      try {
        const entity: any = await client.getEntity(message.chatId);
        if (entity?.phone) {
          return formatPhoneNumber(entity.phone);
        }
      } catch (e) {
        // Ignora erro
      }
    }
  } catch (err) {
    console.warn(`${LOG_PREFIX} Erro ao tentar extrair telefone do evento:`, err);
  }

  return '';
}

export async function handleNewMessage(instanceId: string, event: NewMessageEvent, client?: TelegramClient) {
  const message = event.message;
  let type = 'text';
  let mediaUrl = undefined;

  // Pre-warm entity cache com o remetente dessa mensagem e obtém entidade resolvida
  let senderEntity: any = null;
  if (client) {
    senderEntity = await warmEntityFromEvent(client, event, instanceId);
  }

  const phone = await extractPhoneFromEvent(event, senderEntity, client);

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
    phone,
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

  let senderEntity: any = null;
  if (client) {
    senderEntity = await warmEntityFromEvent(client, event, instanceId);
  }

  const phone = await extractPhoneFromEvent(event, senderEntity, client);

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
    phone,
    chatId: message.chatId?.toString(),
    date: message.date,
    isOutgoing: message.out,
    mediaUrl,
  });
}

export async function handleRawEvent(instanceId: string, event: Api.TypeUpdate, client?: TelegramClient) {
  // ── Atualizações de Chamadas e Vídeo Ligações (MTProto) ───────────────────
  if (event.className === 'UpdatePhoneCall') {
    await callManager.handleCallUpdate(instanceId, (event as any).phoneCall);
    return;
  }

  // ── Ações de Usuário (Digitando, Áudio, Foto, Vídeo, Documento) ───────────
  if (event.className === 'UpdateUserTyping' || event.className === 'UpdateChatUserTyping') {
    const actionName = (event as any).action?.className || '';
    const userId = (event as any).userId?.toString();
    const chatId = (event as any).chatId?.toString() || userId;

    let phone = '';
    if (client && userId) {
      try {
        const user: any = await client.getEntity(userId);
        if (user?.phone) {
          phone = formatPhoneNumber(user.phone);
        }
      } catch (e) {
        // Ignora erro
      }
    }

    const actionData = {
      userId,
      phone,
      chatId,
      action: actionName,
    };

    // Dispara o evento legado/genérico
    await dispatchWebhook(instanceId, 'typing', actionData);

    // Dispara eventos granulares categorizados
    if (actionName === 'SendMessageTypingAction') {
      await dispatchWebhook(instanceId, 'chat.typing', actionData);
    } else if (actionName === 'SendMessageRecordAudioAction' || actionName === 'SendMessageUploadAudioAction') {
      await dispatchWebhook(instanceId, 'chat.recording_audio', actionData);
    } else if (actionName === 'SendMessageUploadPhotoAction') {
      await dispatchWebhook(instanceId, 'chat.uploading_photo', actionData);
    } else if (actionName === 'SendMessageUploadVideoAction' || actionName === 'SendMessageRecordVideoAction') {
      await dispatchWebhook(instanceId, 'chat.uploading_video', actionData);
    } else if (actionName === 'SendMessageUploadDocumentAction') {
      await dispatchWebhook(instanceId, 'chat.uploading_document', actionData);
    }
    return;
  }

  // ── Mensagens Deletadas ──────────────────────────────────────────────────
  if (event.className === 'UpdateDeleteMessages' || event.className === 'UpdateDeleteChannelMessages') {
    await dispatchWebhook(instanceId, 'deleted_message', {
      messages: (event as any).messages,
      channelId: (event as any).channelId?.toString(),
      phone: ''
    });
    return;
  }
}
