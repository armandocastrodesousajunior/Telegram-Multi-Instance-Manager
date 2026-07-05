import { TelegramClient } from 'telegram';
import { Api } from 'telegram';
import { prisma } from '../db';

export async function simulateTyping(client: TelegramClient, instanceId: string, chatId: string, text: string) {
  const settings = await prisma.instanceSettings.findUnique({ where: { instanceId } });
  if (!settings || !settings.typingEnabled) return;

  let duration = 0;
  if (settings.typingUseDuration) {
    const msPerChar = settings.typingMsPerChar || 10;
    duration = Math.min(text.length * msPerChar, 30000); // Max 30s
  } else {
    duration = (settings.typingFixedSeconds || 5) * 1000;
  }
  
  if (duration > 0) {
    try {
      const peer = await client.getInputEntity(chatId);
      const action = new Api.SendMessageTypingAction();
      
      let elapsed = 0;
      while (elapsed < duration) {
        await client.invoke(new Api.messages.SetTyping({ peer, action }));
        const sleepTime = Math.min(4000, duration - elapsed);
        await new Promise(resolve => setTimeout(resolve, sleepTime));
        elapsed += sleepTime;
      }
    } catch (err) {
      console.error('Failed to simulate typing:', err);
    }
  }
}

export async function simulateFileAction(client: TelegramClient, instanceId: string, chatId: string, actionType: 'audio' | 'video' | 'photo' | 'document', realDurationMs?: number) {
  const settings = await prisma.instanceSettings.findUnique({ where: { instanceId } });
  if (!settings) return;

  let enabled = false;
  let duration = 2000;
  let action: Api.TypeSendMessageAction | null = null;

  if (actionType === 'audio' && settings.audioActionEnabled) {
    enabled = true;
    duration = settings.audioUseDuration ? (realDurationMs || settings.audioFixedSeconds * 1000) : (settings.audioFixedSeconds * 1000);
    action = new Api.SendMessageRecordAudioAction();
  } else if (actionType === 'video' && settings.videoActionEnabled) {
    enabled = true;
    duration = settings.videoUseDuration ? (realDurationMs || settings.videoFixedSeconds * 1000) : (settings.videoFixedSeconds * 1000);
    action = new Api.SendMessageRecordVideoAction();
  } else if (actionType === 'photo' && settings.photoActionEnabled) {
    enabled = true;
    duration = settings.photoFixedSeconds * 1000 || 2000;
    action = new Api.SendMessageChooseContactAction(); // GramJS mapping? Actually SendMessageUploadPhotoAction
    action = new Api.SendMessageUploadPhotoAction({ progress: 1 });
  } else if (actionType === 'document' && settings.documentActionEnabled) {
    enabled = true;
    duration = settings.documentFixedSeconds * 1000 || 2000;
    action = new Api.SendMessageUploadDocumentAction({ progress: 1 });
  }

  if (enabled && action) {
    try {
      const peer = await client.getInputEntity(chatId);
      
      let elapsed = 0;
      while (elapsed < duration) {
        await client.invoke(new Api.messages.SetTyping({ peer, action }));
        const sleepTime = Math.min(4000, duration - elapsed);
        await new Promise(resolve => setTimeout(resolve, sleepTime));
        elapsed += sleepTime;
      }
    } catch (err) {
      console.error('Failed to simulate file action:', err);
    }
  }
}
