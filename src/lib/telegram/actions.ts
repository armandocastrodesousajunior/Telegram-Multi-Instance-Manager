import { TelegramClient } from 'telegram';
import { Api } from 'telegram';
import { getOrFetchEntity, getCachedInstanceSettings } from './utils';

export async function simulateTyping(client: TelegramClient, instanceId: string, chatId: string, textOrDuration?: string | number) {
  const settings = await getCachedInstanceSettings(instanceId);
  if (!settings || !settings.typingEnabled) return;

  let duration = 0;
  if (typeof textOrDuration === 'number') {
    duration = textOrDuration;
  } else if (typeof textOrDuration === 'string' && settings.typingUseDuration) {
    const rawText = textOrDuration.replace(/<[^>]*>/g, '');
    const msPerChar = settings.typingMsPerChar || 10;
    duration = rawText.length * msPerChar;
  } else {
    duration = (settings.typingFixedSeconds || 5) * 1000;
  }
  
  // Teto de segurança (Cap): máximo 15s para não prender a fila do worker em textos gigantes
  duration = Math.min(duration, 15000);
  
  if (duration > 0) {
    try {
      const peer = await getOrFetchEntity(client, chatId);
      const action = new Api.SendMessageTypingAction();
      
      const targetEndTime = Date.now() + duration;
      
      while (Date.now() < targetEndTime) {
        // Disparo não-bloqueante (Fire-and-Forget): não espera ACK do TCP socket do GramJS
        client.invoke(new Api.messages.SetTyping({ peer, action })).catch(() => {});
        
        const remaining = targetEndTime - Date.now();
        if (remaining <= 0) break;
        const sleepTime = Math.min(4000, remaining);
        await new Promise(resolve => setTimeout(resolve, sleepTime));
      }
    } catch (err) {
      console.error('Failed to simulate typing:', err);
    }
  }
}

export async function simulateFileAction(client: TelegramClient, instanceId: string, chatId: string, actionType: 'audio' | 'video' | 'photo' | 'document', realDurationMs?: number) {
  const settings = await getCachedInstanceSettings(instanceId);
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
    action = new Api.SendMessageUploadPhotoAction({ progress: 1 });
  } else if (actionType === 'document' && settings.documentActionEnabled) {
    enabled = true;
    duration = settings.documentFixedSeconds * 1000 || 2000;
    action = new Api.SendMessageUploadDocumentAction({ progress: 1 });
  }

  // Teto de segurança: máximo 15s
  duration = Math.min(duration, 15000);

  if (enabled && action) {
    try {
      const peer = await getOrFetchEntity(client, chatId);
      
      const targetEndTime = Date.now() + duration;
      
      while (Date.now() < targetEndTime) {
        // Fire-and-Forget
        client.invoke(new Api.messages.SetTyping({ peer, action: action! })).catch(() => {});
        
        const remaining = targetEndTime - Date.now();
        if (remaining <= 0) break;
        const sleepTime = Math.min(4000, remaining);
        await new Promise(resolve => setTimeout(resolve, sleepTime));
      }
    } catch (err) {
      console.error('Failed to simulate file action:', err);
    }
  }
}

