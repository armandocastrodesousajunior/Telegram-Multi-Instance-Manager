import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { dispatchWebhook } from '@/lib/webhooks/dispatcher';
import { ProviderFactory } from '@/lib/telegram/providers/ProviderFactory';

// Helper to determine media type from Telegram Bot API message
function getMediaType(message: any): string {
  if (message.photo) return 'image';
  if (message.video) return 'video';
  if (message.audio) return 'audio';
  if (message.voice) return 'voice';
  if (message.document) {
    if (message.document.mime_type === 'application/x-tgsticker') return 'sticker';
    return 'document';
  }
  return 'text';
}

async function processPendingDestructions(instance: any, chatId: string) {
  try {
    const pending = await prisma.pendingDestruction.findMany({
      where: { instanceId: instance.id, chatId }
    });

    if (pending.length === 0) return;

    // We need the provider to call deleteMessage
    const provider = await ProviderFactory.getProvider(instance) as any;
    
    // Check if provider has botSelfDestructTimer
    const settings = await prisma.instanceSettings.findUnique({
      where: { instanceId: instance.id }
    });
    
    const waitTime = (settings?.botSelfDestructTimer || 0) * 1000;

    for (const p of pending) {
      if (waitTime > 0) {
        setTimeout(async () => {
          try {
            await provider.deleteBotMessage(chatId, p.messageId);
          } catch (e) {
            console.error(`[BotWebhook] Failed to delete message ${p.messageId} after reply wait time:`, e);
          }
        }, waitTime);
      } else {
        try {
          await provider.deleteBotMessage(chatId, p.messageId);
        } catch (e) {
          console.error(`[BotWebhook] Failed to delete message ${p.messageId} after reply:`, e);
        }
      }
    }

    // Remove from DB immediately so we don't try again
    await prisma.pendingDestruction.deleteMany({
      where: { instanceId: instance.id, chatId }
    });
    
    console.log(`[BotWebhook] Processed ${pending.length} pending destructions for chat ${chatId}`);
  } catch (error) {
    console.error('[BotWebhook] Error processing pending destructions:', error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  try {
    const { instanceId } = await params;
    const body = await req.json();

    const instance = await prisma.instance.findUnique({ where: { id: instanceId } });
    if (!instance || instance.type !== 'BOT') {
      return NextResponse.json({ error: 'Instance not found or not a bot' }, { status: 404 });
    }

    // Handle standard messages (Only for NORMAL bots)
    if (body.message && instance.botType !== 'BUSINESS') {
      const msg = body.message;
      const type = getMediaType(msg);
      
      const payload = {
        id: msg.message_id,
        type,
        content: msg.text || msg.caption || '',
        senderId: msg.from?.id?.toString(),
        chatId: msg.chat?.id?.toString(),
        date: msg.date,
        isOutgoing: msg.from?.id.toString() === instance.botToken?.split(':')[0],
        mediaUrl: undefined, // You might want to implement a route to fetch bot media later if needed
      };

      await dispatchWebhook(instanceId, 'message', payload);
      
      // Process pending destructions after a user reply
      if (!payload.isOutgoing) {
        await processPendingDestructions(instance, payload.chatId);
      }
    }

    // Handle edited messages (Only for NORMAL bots)
    if (body.edited_message && instance.botType !== 'BUSINESS') {
      const msg = body.edited_message;
      const type = getMediaType(msg);
      
      const payload = {
        id: msg.message_id,
        type,
        content: msg.text || msg.caption || '',
        senderId: msg.from?.id?.toString(),
        chatId: msg.chat?.id?.toString(),
        date: msg.date,
        isOutgoing: msg.from?.id.toString() === instance.botToken?.split(':')[0],
        mediaUrl: undefined,
      };

      await dispatchWebhook(instanceId, 'edited_message', payload);
    }

    // Handle business connection events
    if (body.business_connection) {
      const conn = body.business_connection;
      if (conn.is_enabled) {
        await prisma.instance.update({
          where: { id: instanceId },
          data: { businessConnectionId: conn.id }
        });
        console.log(`[BotWebhook] Business connection enabled for instance ${instanceId}: ${conn.id}`);
      } else {
        await prisma.instance.update({
          where: { id: instanceId },
          data: { businessConnectionId: null }
        });
        console.log(`[BotWebhook] Business connection disabled for instance ${instanceId}`);
      }
    }

    // Handle messages inside business connection (Only for BUSINESS bots)
    if (body.business_message && instance.botType === 'BUSINESS') {
      const msg = body.business_message;
      const type = getMediaType(msg);
      
      const payload = {
        id: msg.message_id,
        type,
        content: msg.text || msg.caption || '',
        senderId: msg.from?.id?.toString(),
        chatId: msg.chat?.id?.toString(),
        date: msg.date,
        isOutgoing: msg.from?.id.toString() === instance.botToken?.split(':')[0],
        mediaUrl: undefined,
      };

      // Dispatch as a normal message for internal CRM integration
      await dispatchWebhook(instanceId, 'message', payload);
      
      if (!payload.isOutgoing) {
        await processPendingDestructions(instance, payload.chatId);
      }
    }

    // Handle edited business messages (Only for BUSINESS bots)
    if (body.edited_business_message && instance.botType === 'BUSINESS') {
      const msg = body.edited_business_message;
      const type = getMediaType(msg);
      
      const payload = {
        id: msg.message_id,
        type,
        content: msg.text || msg.caption || '',
        senderId: msg.from?.id?.toString(),
        chatId: msg.chat?.id?.toString(),
        date: msg.date,
        isOutgoing: msg.from?.id.toString() === instance.botToken?.split(':')[0],
        mediaUrl: undefined,
      };

      await dispatchWebhook(instanceId, 'edited_message', payload);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[BotWebhook] Error processing webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
