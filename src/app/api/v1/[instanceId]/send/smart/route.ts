import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { telegramManager } from '@/lib/telegram/client';
import { simulateTyping, simulateFileAction } from '@/lib/telegram/actions';
import { logApiRequest } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { CustomFile } from 'telegram/client/uploads';
import * as mm from 'music-metadata';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { getCachedMedia, saveMediaToCache } from '@/lib/telegram/mediaCache';

interface SmartAction {
  type: string;
  text?: string;
  url?: string;
  filename?: string;
  caption?: string;
  prefetchedPath?: string;
  prefetchedDuration?: number;
  cachedMedia?: any;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { instanceId } = await params;
    const body = await req.json();
    const { chatId, content, replyToMsgId, parseMode } = body;

    if (!chatId || !content) {
      const err = { error: 'chatId and content are required' };
      await logApiRequest({ instanceId, endpoint: '/send/smart', method: 'POST', requestBody: body, responseStatus: 400, responseBody: err, success: false });
      return NextResponse.json(err, { status: 400 });
    }

    const client = await telegramManager.getClient(instanceId);
    
    // Fetch instance settings to check for split messages option
    const settings = await prisma.instanceSettings.findUnique({
      where: { instanceId }
    });
    
    const splitEnabled = settings ? settings.splitMessagesEnabled : true;

    // Parse the content
    const regex = /<(image|video|audio|voice|document|view_once_image|view_once_video)\s+url=["']([^"']+)["'](?:\s+filename=["']([^"']+)["'])?>(.*?)<\/\1>/gis;
    
    const items: SmartAction[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const textBefore = content.substring(lastIndex, match.index);
      if (textBefore.trim()) {
        items.push({ type: 'text', text: textBefore });
      }
      
      items.push({
        type: match[1].toLowerCase(),
        url: match[2],
        filename: match[3] || undefined,
        caption: match[4] || ''
      });
      
      lastIndex = regex.lastIndex;
    }

    const textAfter = content.substring(lastIndex);
    if (textAfter.trim()) {
      items.push({ type: 'text', text: textAfter });
    }

    // Flatten logic for splitMessagesEnabled
    const actions: SmartAction[] = [];
    for (const item of items) {
      if (item.type === 'text') {
        const t = item.text!.trim();
        if (splitEnabled && t.includes('\n\n')) {
          const parts = t.split('\n\n').filter(p => p.trim() !== '');
          for (const p of parts) {
            actions.push({ type: 'text', text: p });
          }
        } else {
          actions.push({ type: 'text', text: t });
        }
      } else {
        actions.push(item);
      }
    }

    // ==========================================
    // STAGE 1: PRE-FETCH DE MÍDIAS
    // ==========================================
    for (const action of actions) {
      if (action.type !== 'text') {
        const isVideo = action.type.includes('video');
        
        if (settings?.mediaCacheEnabled) {
          try {
            const cached = await getCachedMedia(instanceId, action.url!);
            if (cached) {
              action.cachedMedia = cached.media;
              action.prefetchedDuration = cached.durationMs;
              console.log(`[SmartRoute] 🚀 Mídia carregada do Cache Zero-Upload: ${action.url}`);
              continue; // Pula todo o pre-fetch físico!
            }
          } catch(e) {
            console.error(`[SmartRoute] Erro ao ler cache:`, e);
          }
        }

        if (isVideo && settings?.downloadVideoFirst) {
          try {
            console.log(`[SmartRoute] Pre-fetching mídia: ${action.url!}`);
            const res = await fetch(action.url!);
            if (res.ok) {
              const arrayBuffer = await res.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              
              let realDurationMs = 0;
              try {
                const metadata = await mm.parseBuffer(buffer, res.headers.get('content-type') || undefined);
                if (metadata.format.duration) realDurationMs = Math.round(metadata.format.duration * 1000);
              } catch (e) {}

              let ext = 'bin';
              try {
                const parts = new URL(action.url!).pathname.split('.');
                if (parts.length > 1) ext = parts.pop() || 'bin';
              } catch(e) {}
              
              const uniqueId = crypto.randomUUID();
              const finalFilename = action.filename || `media.${ext}`;
              const tempPath = path.join(os.tmpdir(), `${uniqueId}_${finalFilename}`);
              fs.writeFileSync(tempPath, buffer);
              
              action.prefetchedPath = tempPath;
              action.prefetchedDuration = realDurationMs;
              console.log(`[SmartRoute] Pre-fetch concluído: ${tempPath} (${realDurationMs}ms)`);
            } else {
              console.error(`[SmartRoute] Falha no pre-fetch de ${action.url!}: ${res.status}`);
            }
          } catch (e) {
            console.error(`[SmartRoute] Exceção no pre-fetch de ${action.url!}:`, e);
          }
        }
      }
    }

    const messageIds: number[] = [];
    let firstSent = false;

    // ==========================================
    // STAGE 2: EXECUÇÃO EM TEMPO REAL
    // ==========================================
    try {
      // Execute actions sequentially
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const replyTo = !firstSent ? replyToMsgId : undefined;

      if (action.type === 'text') {
        await simulateTyping(client, instanceId, chatId, action.text!);
        const msg = await client.sendMessage(chatId, {
          message: action.text!,
          replyTo: replyTo,
          parseMode: parseMode || undefined
        });
        messageIds.push(msg.id);
      } else {
        const isPhoto = action.type.includes('image');
        const isVideo = action.type.includes('video');
        const isAudio = action.type.includes('audio');
        const isVoice = action.type.includes('voice');
        const isDoc = action.type.includes('document');
        const isViewOnce = action.type.startsWith('view_once_');

        let simAction: 'document' | 'photo' | 'video' | 'audio' = 'document';
        if (isPhoto) simAction = 'photo';
        else if (isVideo) simAction = 'video';
        else if (isAudio || isVoice) simAction = 'audio';

        const originalInvoke = client.invoke.bind(client);
        if (isViewOnce) {
          client.invoke = async (req: any) => {
            if (req.className === 'messages.SendMedia' && req.media) {
              req.media.ttlSeconds = settings?.viewOnceTtlSeconds ?? 2147483647;
            }
            return await originalInvoke(req);
          };
        }

        let fileData: any = action.cachedMedia || action.prefetchedPath || action.url!;
        let realDurationMs = action.prefetchedDuration || 0;

        try {
          console.log(`[SmartRoute] Processando ação de mídia: type=${action.type}, url=${action.url}`);
          // Agora que temos a duração (se aplicável), executamos a simulação de ação visual (ex: gravando áudio)
          await simulateFileAction(client, instanceId, chatId, simAction, realDurationMs);

          console.log(`[SmartRoute] Enviando mídia para o Telegram...`);
          let msg: any;
          try {
            msg = await client.sendFile(chatId, {
              file: fileData,
              caption: action.caption || '',
              forceDocument: isDoc,
              voiceNote: isVoice,
              videoNote: false,
              replyTo: replyTo,
              parseMode: parseMode || undefined
            });
          } catch (uploadErr: any) {
            if (uploadErr.message?.includes('FILE_REFERENCE_EXPIRED') && action.cachedMedia) {
              console.log(`[SmartRoute] Aviso: Cache expirado para ${action.url}. Deletando do banco e tentando novamente com a URL original...`);
              await import('@/lib/db').then(({ prisma }) => prisma.mediaCache.deleteMany({ where: { instanceId, url: action.url! } }));
              action.cachedMedia = null;
              fileData = action.prefetchedPath || action.url!;
              msg = await client.sendFile(chatId, {
                file: fileData,
                caption: action.caption || '',
                forceDocument: isDoc,
                voiceNote: isVoice,
                videoNote: false,
                replyTo: replyTo,
                parseMode: parseMode || undefined
              });
            } else {
              throw uploadErr;
            }
          }
          
          console.log(`[SmartRoute] Mídia enviada com sucesso. Msg ID: ${msg.id}`);
          messageIds.push(msg.id);
          
          if (settings?.mediaCacheEnabled && !action.cachedMedia) {
             await saveMediaToCache(instanceId, action.url!, msg, realDurationMs);
          }
        } catch (uploadErr) {
          console.error(`[SmartRoute] Erro fatal ao enviar mídia:`, uploadErr);
          throw uploadErr; // Propaga para o catch da rota principal
        } finally {
          client.invoke = originalInvoke;
        }
      }

      firstSent = true;
    }
    } finally {
      // ==========================================
      // STAGE 3: LIMPEZA DOS TEMPORÁRIOS
      // ==========================================
      for (const action of actions) {
        if (action.prefetchedPath && fs.existsSync(action.prefetchedPath)) {
          try {
            fs.unlinkSync(action.prefetchedPath);
            console.log(`[SmartRoute] Arquivo temporário limpo: ${action.prefetchedPath}`);
          } catch (e) {}
        }
      }
    }

    const resData = { success: true, messageIds };
    await logApiRequest({ instanceId, endpoint: '/send/smart', method: 'POST', requestBody: body, responseStatus: 200, responseBody: resData, success: true });
    return NextResponse.json(resData);
  } catch (err: any) {
    const errBody = { error: err.message };
    await logApiRequest({ instanceId: (await params).instanceId, endpoint: '/send/smart', method: 'POST', requestBody: null, responseStatus: 500, responseBody: errBody, success: false });
    return NextResponse.json(errBody, { status: 500 });
  }
}
