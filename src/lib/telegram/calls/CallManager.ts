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
  isLinkCall?: boolean;
  link?: string;
  groupCallAccessHash?: bigInt.BigInteger;
  channelId?: any;
  targetUserId?: string;
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

    let inputUser: any = peerEntity;
    if (peerEntity?.className === 'InputPeerUser') {
      inputUser = new Api.InputUser({
        userId: peerEntity.userId,
        accessHash: peerEntity.accessHash
      });
    } else if (peerEntity?.className === 'User') {
      inputUser = new Api.InputUser({
        userId: peerEntity.id,
        accessHash: peerEntity.accessHash || bigInt(0) as any
      });
    }

    const callResult = await client.invoke(
      new Api.phone.RequestCall({
        userId: inputUser,
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

  // ── CHAMADAS DE VÍDEO VIA LINK NATIVO DO TELEGRAM (GROUPCALL) ──────────────

  private instanceCallChannels = new Map<string, any>();

  /**
   * Obtém ou cria o canal privado dedicado para sediar as chamadas de vídeo via link da instância.
   */
  private async getOrCreateCallChannel(client: TelegramClient, instanceId: string): Promise<any> {
    const cached = this.instanceCallChannels.get(instanceId);
    if (cached) return cached;

    try {
      const dialogs = await client.getDialogs({ limit: 40 });
      for (const d of dialogs) {
        if (d.isChannel && d.title?.startsWith('Chamadas - ')) {
          this.instanceCallChannels.set(instanceId, d.entity);
          return d.entity;
        }
      }
    } catch (e) {}

    const res = await client.invoke(
      new Api.channels.CreateChannel({
        title: `Chamadas - Sistema`,
        about: 'Canal dedicado para salas de chamadas via link do Telegram',
        megagroup: true,
        broadcast: false
      })
    );

    const channel = (res as any).chats?.[0];
    if (!channel) throw new Error('Não foi possível criar o canal de chamadas no Telegram.');

    this.instanceCallChannels.set(instanceId, channel);
    return channel;
  }

  /**
   * Inicia uma chamada de vídeo via link oficial do Telegram (GroupCall Invite).
   */
  async initiateCallViaLink(
    client: TelegramClient,
    instanceId: string,
    peerEntity: any,
    chatId: string,
    videoUrl: string,
    videoDurationSeconds: number,
    options: {
      timeoutSeconds?: number;
      hangupOnVideoEnd?: boolean;
      messageText?: string;
    } = {}
  ): Promise<{ callId: string; link: string; status: string; videoDurationSeconds: number }> {
    const timeoutSeconds = options.timeoutSeconds ?? 60;
    const hangupOnVideoEnd = options.hangupOnVideoEnd ?? true;

    // 1. Obter ou criar canal dedicado
    const callChannel = await this.getOrCreateCallChannel(client, instanceId);
    const channelInput = await client.getInputEntity(callChannel);

    // 2. Criar ou reutilizar GroupCall no canal
    const randomId = Math.floor(Math.random() * 0x7FFFFFFF);
    let groupCallObj: any = null;

    try {
      const callRes = await client.invoke(
        new Api.phone.CreateGroupCall({
          peer: channelInput,
          randomId,
          rtmpStream: false
        })
      );
      for (const upd of (callRes as any).updates || []) {
        if (upd.className === 'UpdateGroupCall') {
          groupCallObj = upd.call;
          break;
        }
      }
    } catch (createErr: any) {
      if (createErr.message?.includes('GROUPCALL_ALREADY_EXISTS') || (callChannel as any).call) {
        try {
          const activeCallInput = (callChannel as any).call;
          if (activeCallInput) {
            await client.invoke(new Api.phone.DiscardGroupCall({ call: activeCallInput }));
          }
        } catch (dErr) {}
        const retryRes = await client.invoke(
          new Api.phone.CreateGroupCall({
            peer: channelInput,
            randomId: Math.floor(Math.random() * 0x7FFFFFFF),
            rtmpStream: false
          })
        );
        for (const upd of (retryRes as any).updates || []) {
          if (upd.className === 'UpdateGroupCall') {
            groupCallObj = upd.call;
            break;
          }
        }
      } else {
        throw createErr;
      }
    }

    if (!groupCallObj) {
      throw new Error('Falha ao inicializar sala de chamada no Telegram.');
    }

    const callId = groupCallObj.id?.toString() || randomId.toString();

    // 3. Exportar Link oficial de convite do Telegram
    const inputCall = new Api.InputGroupCall({
      id: bigInt(groupCallObj.id.toString()),
      accessHash: bigInt(groupCallObj.accessHash.toString())
    });

    let callLink = '';
    try {
      const exported = await client.invoke(
        new Api.phone.ExportGroupCallInvite({
          call: inputCall,
          canSelfUnmute: true
        })
      );
      callLink = exported.link;
    } catch (exportErr: any) {
      console.log('[CallManager] ExportGroupCallInvite falhou (canal privado). Gerando link via ExportChatInvite...');
      const chatInvite: any = await client.invoke(
        new Api.messages.ExportChatInvite({
          peer: channelInput
        })
      );
      callLink = chatInvite.link ? `${chatInvite.link}?videochat` : chatInvite.link;
    }

    // Opcional: Convida o usuário formalmente para o chat de vídeo (gera notificação no Telegram dele)
    try {
      await client.invoke(
        new Api.phone.InviteToGroupCall({
          call: inputCall,
          users: [peerEntity]
        })
      );
    } catch (invErr: any) {
      console.log('[CallManager] InviteToGroupCall info/non-critical:', invErr?.message);
    }

    // 4. Enviar mensagem com o link para o destinatário no chat
    const defaultMsg = `📞 Iniciei uma chamada de vídeo com você.\n\nToque no link abaixo para entrar:\n👉 ${callLink}`;
    let textToSend = defaultMsg;
    if (options.messageText) {
      textToSend = options.messageText.includes('{link}')
        ? options.messageText.replace('{link}', callLink)
        : `${options.messageText}\n\n👉 ${callLink}`;
    }

    await client.sendMessage(peerEntity, { message: textToSend });

    // 5. Registrar chamada ativa
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
      hungUpBy: 'caller',
      isLinkCall: true,
      link: callLink,
      groupCallAccessHash: bigInt(groupCallObj.accessHash.toString()),
      channelId: callChannel.id,
      targetUserId: (peerEntity as any).id?.toString() || chatId.toString()
    };

    // Timer de timeout (se o lead não entrar no link dentro do prazo)
    activeCall.timeoutTimer = setTimeout(async () => {
      if (this.activeCalls.has(callId) && activeCall.state === 'ringing') {
        console.log(`[CallManager] Call via Link ${callId} timed out after ${timeoutSeconds}s without lead joining.`);
        await this.discardGroupCall(callId, 'missed');
      }
    }, timeoutSeconds * 1000);

    this.activeCalls.set(callId, activeCall);

    // Disparar webhook de link gerado / chamada aguardando
    await dispatchWebhook(instanceId, 'call.ringing', {
      callId,
      chatId,
      videoUrl,
      videoDurationSeconds,
      timeoutSeconds,
      status: 'ringing',
      mode: 'link',
      link: callLink,
      initiatedAt: activeCall.initiatedAt
    });

    return {
      callId,
      link: callLink,
      status: 'link_sent',
      videoDurationSeconds
    };
  }

  /**
   * Processa atualizações de participantes de chamadas via link (GroupCall).
   */
  async handleGroupCallParticipantsUpdate(instanceId: string, update: any) {
    if (!update || !update.call) return;
    const callId = update.call.id?.toString();
    const call = this.activeCalls.get(callId);
    if (!call) return;

    const participants = update.participants || [];
    for (const p of participants) {
      if (p.self) continue;

      // 1. Lead acabou de entrar na chamada de vídeo!
      if (p.justJoined || (!p.left && call.state === 'ringing')) {
        call.state = 'accepted';
        call.answeredAt = Date.now();

        if (call.timeoutTimer) {
          clearTimeout(call.timeoutTimer);
          call.timeoutTimer = undefined;
        }

        console.log(`[CallManager] Lead entered Call via Link ${callId}!`);

        await dispatchWebhook(instanceId, 'call.accepted', {
          callId,
          chatId: call.chatId,
          mode: 'link',
          link: call.link,
          videoUrl: call.videoUrl,
          videoDurationSeconds: call.videoDurationSeconds,
          status: 'accepted',
          answeredAt: call.answeredAt
        });

        // Desligar quando o vídeo acabar
        if (call.hangupOnVideoEnd && call.videoDurationSeconds > 0) {
          call.hangupTimer = setTimeout(async () => {
            console.log(`[CallManager] Video playback finished on link call (${call.videoDurationSeconds}s). Ending call.`);
            call.hungUpBy = 'caller';
            await this.discardGroupCall(callId, 'hangup');

            const telemetryPayload = {
              callId,
              chatId: call.chatId,
              answered: true,
              status: 'completed',
              mode: 'link',
              link: call.link,
              durationSeconds: call.videoDurationSeconds,
              videoDurationSeconds: call.videoDurationSeconds,
              retentionPercentage: 100,
              completedFullVideo: true,
              hungUpBy: 'caller',
              initiatedAt: call.initiatedAt,
              answeredAt: call.answeredAt,
              endedAt: Date.now()
            };
            await dispatchWebhook(instanceId, 'call.completed', telemetryPayload);
            await dispatchWebhook(instanceId, 'call.ended', telemetryPayload);
          }, call.videoDurationSeconds * 1000);
        }
      }

      // 2. Lead desligou / saiu da chamada!
      else if (p.left && call.answeredAt) {
        call.endedAt = Date.now();
        if (call.hangupTimer) clearTimeout(call.hangupTimer);

        const durationSeconds = Math.max(1, Math.round((call.endedAt - call.answeredAt) / 1000));
        const videoDuration = call.videoDurationSeconds || 1;
        const retentionPercentage = Math.min(100, Math.round((durationSeconds / videoDuration) * 100));
        const isCompleted = durationSeconds >= (videoDuration - 2) || retentionPercentage >= 95;
        const finalStatus = isCompleted ? 'completed' : 'abandoned';

        console.log(`[CallManager] Lead left link call ${callId}. Duration: ${durationSeconds}s (${retentionPercentage}%). Status: ${finalStatus}`);

        const telemetryPayload = {
          callId,
          chatId: call.chatId,
          answered: true,
          status: finalStatus,
          mode: 'link',
          link: call.link,
          durationSeconds,
          videoDurationSeconds: call.videoDurationSeconds,
          retentionPercentage,
          completedFullVideo: isCompleted,
          hungUpBy: 'callee',
          initiatedAt: call.initiatedAt,
          answeredAt: call.answeredAt,
          endedAt: call.endedAt
        };

        if (isCompleted) {
          await dispatchWebhook(instanceId, 'call.completed', telemetryPayload);
        } else {
          await dispatchWebhook(instanceId, 'call.abandoned', telemetryPayload);
        }
        await dispatchWebhook(instanceId, 'call.ended', telemetryPayload);

        await this.discardGroupCall(callId, 'hangup');
      }
    }
  }

  /**
   * Descarta / encerra uma chamada via link (GroupCall).
   */
  async discardGroupCall(callId: string, reason: 'hangup' | 'missed' = 'hangup') {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    try {
      if (call.groupCallAccessHash) {
        await call.client.invoke(
          new Api.phone.DiscardGroupCall({
            call: new Api.InputGroupCall({
              id: bigInt(callId),
              accessHash: call.groupCallAccessHash
            })
          })
        );
      }
    } catch (err: any) {
      console.warn(`[CallManager] DiscardGroupCall non-critical error for ${callId}:`, err?.message || err);
    } finally {
      if (reason === 'missed') {
        const payload = {
          callId,
          chatId: call.chatId,
          answered: false,
          status: 'missed',
          mode: 'link',
          link: call.link,
          durationSeconds: 0,
          videoDurationSeconds: call.videoDurationSeconds,
          retentionPercentage: 0,
          completedFullVideo: false,
          hungUpBy: 'caller',
          initiatedAt: call.initiatedAt,
          endedAt: Date.now()
        };
        await dispatchWebhook(call.instanceId, 'call.missed', payload);
        await dispatchWebhook(call.instanceId, 'call.ended', payload);
      }
      this.activeCalls.delete(callId);
    }
  }
}

export const callManager = new CallManager();
