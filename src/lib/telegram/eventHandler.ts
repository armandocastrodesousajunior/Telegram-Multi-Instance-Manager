import { dispatchWebhook } from '../webhooks/dispatcher';
import { Api } from 'telegram';
import { NewMessageEvent } from 'telegram/events/NewMessage';
import { EditedMessageEvent } from 'telegram/events/EditedMessage';

export async function handleNewMessage(instanceId: string, event: NewMessageEvent) {
  const message = event.message;
  await dispatchWebhook(instanceId, 'message', {
    id: message.id,
    text: message.message,
    senderId: message.senderId?.toString(),
    chatId: message.chatId?.toString(),
    date: message.date,
  });
}

export async function handleEditedMessage(instanceId: string, event: EditedMessageEvent) {
  const message = event.message;
  await dispatchWebhook(instanceId, 'edited_message', {
    id: message.id,
    text: message.message,
    senderId: message.senderId?.toString(),
    chatId: message.chatId?.toString(),
    date: message.date,
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
