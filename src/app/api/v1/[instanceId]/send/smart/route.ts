import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { telegramManager } from '@/lib/telegram/client';
import { simulateTyping, simulateFileAction } from '@/lib/telegram/actions';
import { logApiRequest } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { CustomFile } from 'telegram/client/uploads';

interface SmartAction {
  type: string;
  text?: string;
  url?: string;
  filename?: string;
  caption?: string;
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

    const messageIds: number[] = [];
    let firstSent = false;

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

        await simulateFileAction(client, instanceId, chatId, simAction);

        const originalInvoke = client.invoke.bind(client);
        if (isViewOnce) {
          client.invoke = async (req: any) => {
            if (req.className === 'messages.SendMedia' && req.media) {
              req.media.ttlSeconds = 2147483647;
            }
            return await originalInvoke(req);
          };
        }

        try {
          console.log(`[SmartRoute] Processando ação de mídia: type=${action.type}, url=${action.url}`);
          let fileData: any = action.url!;
          
          try {
            console.log(`[SmartRoute] Iniciando download do buffer da URL: ${action.url!}`);
            const res = await fetch(action.url!);
            console.log(`[SmartRoute] Resposta do fetch: status=${res.status}, ok=${res.ok}`);
            if (res.ok) {
              const arrayBuffer = await res.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              console.log(`[SmartRoute] Buffer criado com sucesso. Tamanho: ${buffer.byteLength} bytes`);
              let ext = 'bin';
              try {
                const urlPath = new URL(action.url!).pathname;
                const parts = urlPath.split('.');
                if (parts.length > 1) ext = parts.pop() || 'bin';
              } catch(e) {}
              const finalFilename = action.filename || `media.${ext}`;
              
              // Instanciamos o CustomFile original da biblioteca
              const customFile = new CustomFile(finalFilename, buffer.byteLength, "", buffer);
              
              console.log(`[SmartRoute] Fazendo o upload do arquivo para os servidores do Telegram...`);
              fileData = await client.uploadFile({
                file: customFile,
                workers: 1
              });
              console.log(`[SmartRoute] Arquivo carregado na nuvem do Telegram com sucesso.`);
            } else {
              console.error(`[SmartRoute] Falha ao baixar mídia de ${action.url!}: ${res.status} ${res.statusText}`);
            }
          } catch (fetchErr) {
            console.error("[SmartRoute] Exceção ao baixar buffer da mídia, caindo para URL direta:", fetchErr);
          }

          console.log(`[SmartRoute] Enviando mídia para o Telegram...`);
          const msg = await client.sendFile(chatId, {
            file: fileData,
            caption: action.caption || '',
            forceDocument: isDoc,
            voiceNote: isVoice,
            videoNote: false,
            replyTo: replyTo,
            parseMode: parseMode || undefined
          });
          console.log(`[SmartRoute] Mídia enviada com sucesso. Msg ID: ${msg.id}`);
          messageIds.push(msg.id);
        } catch (uploadErr) {
          console.error(`[SmartRoute] Erro fatal ao enviar mídia:`, uploadErr);
          throw uploadErr; // Propaga para o catch da rota principal
        } finally {
          client.invoke = originalInvoke;
        }
      }

      firstSent = true;
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
