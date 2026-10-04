import { TelegramClient } from 'telegram';
import { Api } from 'telegram';
import { getOrFetchEntity, getCachedInstanceSettings, PeerResolution } from './utils';
import { getWorkerPool } from '../workers/WorkerPool';

// ── Tipos exportados ──────────────────────────────────────────────────────────

export interface SimulationResult {
  peerResolution: PeerResolution;
  simulationMs: number;
}

// ── simulateTyping ────────────────────────────────────────────────────────────

/**
 * Simula o indicador "digitando..." no Telegram usando Worker Thread Pool.
 *
 * O timer de espera é executado no Event Loop isolado de um Worker Thread,
 * eliminando o Timer Drift causado pela concorrência de 200+ conversas simultâneas.
 *
 * O client.invoke(SetTyping) é disparado como fire-and-forget no main thread,
 * pois o TelegramClient não pode ser compartilhado entre threads.
 */
export async function simulateTyping(
  client: TelegramClient,
  instanceId: string,
  chatId: string,
  textOrDuration?: string | number
): Promise<SimulationResult> {
  const settings = await getCachedInstanceSettings(instanceId);
  const { entity: peer, resolution: peerResolution } = await getOrFetchEntity(client, chatId);

  if (!settings || !settings.typingEnabled) {
    return { peerResolution, simulationMs: 0 };
  }

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

  // Teto de segurança via env ou padrão do pool
  const maxMs = getWorkerPool().simulationMaxMs;
  duration = Math.min(duration, maxMs);

  if (duration <= 0) return { peerResolution, simulationMs: 0 };

  // Pré-cria a action fora do callback para evitar alocação repetida
  const typingAction = new Api.SendMessageTypingAction();

  const { simulationMs } = await getWorkerPool().runSimulation(
    duration,
    // onSignal: chamado no main thread a cada ~4s pelo worker (fire-and-forget)
    () => {
      client.invoke(new Api.messages.SetTyping({ peer, action: typingAction })).catch(() => {});
    }
  );

  return { peerResolution, simulationMs };
}

// ── simulateFileAction ────────────────────────────────────────────────────────

/**
 * Simula o indicador de envio de arquivo no Telegram usando Worker Thread Pool.
 * Suporta: 'audio' (gravando), 'video' (gravando), 'photo' (enviando foto), 'document' (enviando arquivo).
 */
export async function simulateFileAction(
  client: TelegramClient,
  instanceId: string,
  chatId: string,
  actionType: 'audio' | 'video' | 'photo' | 'document',
  realDurationMs?: number
): Promise<SimulationResult> {
  const settings = await getCachedInstanceSettings(instanceId);
  const { entity: peer, resolution: peerResolution } = await getOrFetchEntity(client, chatId);

  if (!settings) return { peerResolution, simulationMs: 0 };

  let enabled = false;
  let duration = 2000;
  let fileAction: Api.TypeSendMessageAction | null = null;

  if (actionType === 'audio' && settings.audioActionEnabled) {
    enabled  = true;
    duration = settings.audioUseDuration
      ? (realDurationMs || settings.audioFixedSeconds * 1000)
      : settings.audioFixedSeconds * 1000;
    fileAction = new Api.SendMessageRecordAudioAction();

  } else if (actionType === 'video' && settings.videoActionEnabled) {
    enabled  = true;
    duration = settings.videoUseDuration
      ? (realDurationMs || settings.videoFixedSeconds * 1000)
      : settings.videoFixedSeconds * 1000;
    fileAction = new Api.SendMessageRecordVideoAction();

  } else if (actionType === 'photo' && settings.photoActionEnabled) {
    enabled    = true;
    duration   = settings.photoFixedSeconds * 1000 || 2000;
    fileAction = new Api.SendMessageUploadPhotoAction({ progress: 1 });

  } else if (actionType === 'document' && settings.documentActionEnabled) {
    enabled    = true;
    duration   = settings.documentFixedSeconds * 1000 || 2000;
    fileAction = new Api.SendMessageUploadDocumentAction({ progress: 1 });
  }

  if (!enabled || !fileAction) return { peerResolution, simulationMs: 0 };

  const maxMs = getWorkerPool().simulationMaxMs;
  duration = Math.min(duration, maxMs);

  // Captura referência antes do callback para evitar closure stale
  const capturedAction = fileAction;

  const { simulationMs } = await getWorkerPool().runSimulation(
    duration,
    () => {
      client.invoke(new Api.messages.SetTyping({ peer, action: capturedAction })).catch(() => {});
    }
  );

  return { peerResolution, simulationMs };
}

// ── Helpers de Ações de Chat (Chat Actions) ───────────────────────────────────

export const SUPPORTED_ACTIONS = [
  'typing',
  'record_audio',
  'upload_audio',
  'record_video',
  'upload_video',
  'upload_photo',
  'upload_document',
  'choose_sticker',
  'find_location',
  'record_video_note',
  'upload_video_note',
  'cancel'
] as const;

export type SupportedAction = typeof SUPPORTED_ACTIONS[number] | string;

export function normalizeActionName(actionName: string): string {
  const norm = (actionName || '').toLowerCase().replace(/[-_]/g, '');
  switch (norm) {
    case 'typing':
    case 'text':
      return 'typing';
    case 'recordaudio':
    case 'recordingaudio':
    case 'recordvoice':
    case 'recordingvoice':
    case 'voice':
      return 'record_audio';
    case 'uploadaudio':
    case 'uploadingaudio':
    case 'uploadvoice':
    case 'uploadingvoice':
    case 'audio':
      return 'upload_audio';
    case 'recordvideo':
    case 'recordingvideo':
      return 'record_video';
    case 'uploadvideo':
    case 'uploadingvideo':
    case 'video':
      return 'upload_video';
    case 'uploadphoto':
    case 'uploadingphoto':
    case 'photo':
    case 'image':
      return 'upload_photo';
    case 'uploaddocument':
    case 'uploadingdocument':
    case 'document':
    case 'file':
      return 'upload_document';
    case 'choosesticker':
    case 'sticker':
      return 'choose_sticker';
    case 'findlocation':
    case 'location':
    case 'geolocation':
      return 'find_location';
    case 'recordround':
    case 'recordvideonote':
    case 'recordingvideonote':
    case 'videonote':
      return 'record_video_note';
    case 'uploadround':
    case 'uploadvideonote':
    case 'uploadingvideonote':
      return 'upload_video_note';
    case 'cancel':
    case 'stop':
      return 'cancel';
    default:
      return 'typing';
  }
}

export function getTelegramActionClass(actionName: string): Api.TypeSendMessageAction {
  const action = normalizeActionName(actionName);
  switch (action) {
    case 'record_audio':
      return new Api.SendMessageRecordAudioAction();
    case 'upload_audio':
      return new Api.SendMessageUploadAudioAction({ progress: 1 });
    case 'record_video':
      return new Api.SendMessageRecordVideoAction();
    case 'upload_video':
      return new Api.SendMessageUploadVideoAction({ progress: 1 });
    case 'upload_photo':
      return new Api.SendMessageUploadPhotoAction({ progress: 1 });
    case 'upload_document':
      return new Api.SendMessageUploadDocumentAction({ progress: 1 });
    case 'choose_sticker':
      return new Api.SendMessageChooseStickerAction();
    case 'find_location':
      return new Api.SendMessageGeoLocationAction();
    case 'record_video_note':
      return new Api.SendMessageRecordRoundAction();
    case 'upload_video_note':
      return new Api.SendMessageUploadRoundAction({ progress: 1 });
    case 'cancel':
      return new Api.SendMessageCancelAction();
    case 'typing':
    default:
      return new Api.SendMessageTypingAction();
  }
}

export function getBotApiAction(actionName: string): string {
  const action = normalizeActionName(actionName);
  switch (action) {
    case 'record_audio':
      return 'record_voice';
    case 'upload_audio':
      return 'upload_voice';
    case 'record_video':
      return 'record_video';
    case 'upload_video':
      return 'upload_video';
    case 'upload_photo':
      return 'upload_photo';
    case 'upload_document':
      return 'upload_document';
    case 'choose_sticker':
      return 'choose_sticker';
    case 'find_location':
      return 'find_location';
    case 'record_video_note':
      return 'record_video_note';
    case 'upload_video_note':
      return 'upload_video_note';
    case 'cancel':
      return 'typing';
    case 'typing':
    default:
      return 'typing';
  }
}

