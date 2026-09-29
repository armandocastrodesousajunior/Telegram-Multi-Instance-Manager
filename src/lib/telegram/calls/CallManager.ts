import { TelegramClient, Api } from 'telegram';
import { dispatchWebhook } from '@/lib/webhooks/dispatcher';
import crypto from 'crypto';
import bigInt from 'big-integer';

export interface ActiveCall {
  callId: string;
  instanceId: string;
  chatId: string;
  videoUrl: string;
  videoDurationSeconds: number;
  timeoutSeconds: number;
  hangupOnVideoEnd: boolean;
  state: 'ringing' | 'accepted' | 'completed' | 'abandoned' | 'declined' | 'missed';
  initiatedAt: number;
  answeredAt?: number;
  endedAt?: number;
  timeoutTimer?: NodeJS.Timeout;
  hangupTimer?: NodeJS.Timeout;
  client: TelegramClient;
  hungUpBy: 'caller' | 'callee';
}

class CallManager {
  private activeCalls = new Map<string, ActiveCall>();

  /**
   * Inicia uma chamada de vídeo usando a conta Telegram USER via MTProto.
   */
  async initiateVideoCall(
    client: TelegramClient,
    instanceId: string,
    peerEntity: any,
    chatId: string,
    videoUrl: string,
    videoDurationSeconds: number,
    options: {
      timeoutSeconds?: number;
      hangupOnVideoEnd?: boolean;
    } = {}
  ): Promise<{ callId: string; status: string; videoDurationSeconds: number }> {
    const timeoutSeconds = options.timeoutSeconds ?? 30;
    const hangupOnVideoEnd = options.hangupOnVideoEnd ?? true;

    // Gera o gAHash (32 bytes aleatórios para o Diffie-Hellman)
    const gAHash = crypto.randomBytes(32);
    const randomId = Math.floor(Math.random() * 0x7FFFFFFF);

    const callResult = await client.invoke(
      new Api.phone.RequestCall({
        userId: peerEntity,
        randomId,
        gAHash,
        protocol: new Api.PhoneCallProtocol({
          minLayer: 65,
          maxLayer: 93,
          udpP2p: true,
          udpReflector: true,
          libraryVersions: ['3.0.0']
        }),
        video: true
      })
    );

    const phoneCallObj = (callResult as any).phoneCall || callResult;
    const callId = phoneCallObj.id?.toString() || randomId.toString();

    const activeCall: ActiveCall = {
      callId,
      instanceId,
      chatId,
      videoUrl,
      videoDurationSeconds,
      timeoutSeconds,
      hangupOnVideoEnd,
      state: 'ringing',
      initiatedAt: Date.now(),
      client,
      hungUpBy: 'caller'
    };

    // Timer de timeout (se o lead não atender dentro do tempo)
    activeCall.timeoutTimer = setTimeout(async () => {
      if (this.activeCalls.has(callId) && activeCall.state === 'ringing') {
        console.log(`[CallManager] Call ${callId} timed out after ${timeoutSeconds}s without answer.`);
        await this.discardCall(callId, 'missed');
      }
    }, timeoutSeconds * 1000);

    this.activeCalls.set(callId, activeCall);

    // Dispara webhook de chamada tocando
    await dispatchWebhook(instanceId, 'call.ringing', {
      callId,
      chatId,
      videoUrl,
      videoDurationSeconds,
      timeoutSeconds,
      status: 'ringing',
      initiatedAt: activeCall.initiatedAt
    });

    return {
      callId,
      status: 'ringing',
      videoDurationSeconds
    };
  }

  /**
   * Processa eventos de chamada (UpdatePhoneCall) emitidos pelo GramJS.
   */
  async handleCallUpdate(instanceId: string, phoneCall: any) {
    if (!phoneCall || !phoneCall.id) return;
    const callId = phoneCall.id.toString();

    let call = this.activeCalls.get(callId);
    // Se não encontrou por ID exato, tenta encontrar pelo instanceId se for a única chamada ativa
    if (!call) {
      for (const [_, c] of this.activeCalls.entries()) {
        if (c.instanceId === instanceId) {
          call = c;
          break;
        }
      }
    }

    if (!call) return;

    const className = phoneCall.className;

    // Chamada atendida pelo lead
    if (className === 'PhoneCallAccepted' || className === 'PhoneCall') {
      if (call.state === 'ringing') {
        call.state = 'accepted';
        call.answeredAt = Date.now();

        // Limpa o timer de timeout
        if (call.timeoutTimer) {
          clearTimeout(call.timeoutTimer);
          call.timeoutTimer = undefined;
        }

        console.log(`[CallManager] Call ${callId} was answered by lead!`);

        await dispatchWebhook(instanceId, 'call.accepted', {
          callId,
          chatId: call.chatId,
          videoUrl: call.videoUrl,
          videoDurationSeconds: call.videoDurationSeconds,
          status: 'accepted',
          answeredAt: call.answeredAt
        });

        // Se configurado para desligar quando o vídeo acabar
        if (call.hangupOnVideoEnd && call.videoDurationSeconds > 0) {
          call.hangupTimer = setTimeout(async () => {
            console.log(`[CallManager] Video playback finished (${call.videoDurationSeconds}s). Ending call.`);
            call.hungUpBy = 'caller';
            await this.discardCall(callId, 'hangup');
          }, call.videoDurationSeconds * 1000);
        }
      }
    }

    // Chamada encerrada / descartada
    else if (className === 'PhoneCallDiscarded') {
      call.endedAt = Date.now();

      if (call.timeoutTimer) clearTimeout(call.timeoutTimer);
      if (call.hangupTimer) clearTimeout(call.hangupTimer);

      const durationSeconds = Number(phoneCall.duration || 0);
      const videoDuration = call.videoDurationSeconds || 1;
      const retentionPercentage = Math.min(100, Math.round((durationSeconds / videoDuration) * 100));

      const reasonObj = phoneCall.reason;
      let disconnectReason = 'unknown';

      if (reasonObj) {
        if (reasonObj.className === 'PhoneCallDiscardReasonBusy') disconnectReason = 'busy';
        else if (reasonObj.className === 'PhoneCallDiscardReasonMissed') disconnectReason = 'missed';
        else if (reasonObj.className === 'PhoneCallDiscardReasonDisconnect') disconnectReason = 'disconnect';
        else if (reasonObj.className === 'PhoneCallDiscardReasonHangup') disconnectReason = 'hangup';
      }

      let finalStatus: 'completed' | 'abandoned' | 'declined' | 'missed' = 'missed';

      if (disconnectReason === 'busy') {
        finalStatus = 'declined';
      } else if (disconnectReason === 'missed') {
        finalStatus = 'missed';
      } else if (call.answeredAt || durationSeconds > 0) {
        // Se atendeu:
        if (durationSeconds >= (videoDuration - 2) || retentionPercentage >= 95) {
          finalStatus = 'completed';
        } else {
          finalStatus = 'abandoned';
        }
      } else {
        finalStatus = 'missed';
      }

      call.state = finalStatus;

      const telemetryPayload = {
        callId,
        chatId: call.chatId,
        answered: !!call.answeredAt || durationSeconds > 0,
        status: finalStatus,
        durationSeconds,
        videoDurationSeconds: call.videoDurationSeconds,
        retentionPercentage,
        completedFullVideo: finalStatus === 'completed',
        hungUpBy: call.hungUpBy,
        disconnectReason,
        initiatedAt: call.initiatedAt,
        answeredAt: call.answeredAt,
        endedAt: call.endedAt
      };

      // Dispara o webhook específico de status
      if (finalStatus === 'completed') {
        await dispatchWebhook(instanceId, 'call.completed', telemetryPayload);
      } else if (finalStatus === 'abandoned') {
        await dispatchWebhook(instanceId, 'call.abandoned', telemetryPayload);
      } else if (finalStatus === 'declined') {
        await dispatchWebhook(instanceId, 'call.declined', telemetryPayload);
      } else if (finalStatus === 'missed') {
        await dispatchWebhook(instanceId, 'call.missed', telemetryPayload);
      }

      // Dispara sempre o evento consolidado call.ended
      await dispatchWebhook(instanceId, 'call.ended', telemetryPayload);

      // Limpa a chamada ativa
      this.activeCalls.delete(callId);
    }
  }

  /**
   * Encerra ativamente uma chamada via MTProto.
   */
  async discardCall(callId: string, reason: 'hangup' | 'missed' | 'busy' = 'hangup') {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    try {
      let reasonApi: any = new Api.PhoneCallDiscardReasonHangup();
      if (reason === 'missed') reasonApi = new Api.PhoneCallDiscardReasonMissed();
      else if (reason === 'busy') reasonApi = new Api.PhoneCallDiscardReasonBusy();

      await call.client.invoke(
        new Api.phone.DiscardCall({
          peer: new Api.InputPhoneCall({
            id: bigInt(call.callId),
            accessHash: bigInt(0)
          }),
          duration: 0,
          reason: reasonApi,
          connectionId: bigInt(0)
        })
      );
    } catch (err: any) {
      console.warn(`[CallManager] DiscardCall non-critical error for ${callId}:`, err?.message || err);
    } finally {
      this.activeCalls.delete(callId);
    }
  }
}

export const callManager = new CallManager();
