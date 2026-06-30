import { dispatchWebhook } from '../webhooks/dispatcher';
import { Api } from 'telegram';
import { NewMessageEvent } from 'telegram/events/NewMessage';
import { EditedMessageEvent } from 'telegram/events/EditedMessage';

export async function handleNewMessage(instanceId: string, event: NewMessageEvent) {
  const message = event.message;
  let type = 'text';
  let mediaUrl = undefined;

  if (message.media) {
    const ttl = (message.media as any).ttlSeconds;
    const isViewOnce = ttl && ttl > 0;

    if (message.photo) {
      type = isViewOnce ? 'view_once_image' : 'image';
    } else if (message.video) {
      type = isViewOnce ? 'view_once_video' : 'video';
    } else if (message.audio) {
      type = isViewOnce ? 'view_once_audio' : 'audio'; // Just in case Telegram supports view-once audio
    } else if (message.voice) {
      type = isViewOnce ? 'view_once_voice' : 'voice'; // View-once voice notes
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

export async function handleEditedMessage(instanceId: string, event: EditedMessageEvent) {
  const message = event.message;
  let type = 'text';
  let mediaUrl = undefined;

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
