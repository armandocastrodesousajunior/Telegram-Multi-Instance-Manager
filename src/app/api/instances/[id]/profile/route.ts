import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { telegramManager } from '@/lib/telegram/client';
import { Api } from 'telegram';
import { prisma } from '@/lib/db';
import { ProviderFactory } from '@/lib/telegram/providers/ProviderFactory';
import { BotApiProvider } from '@/lib/telegram/providers/BotApiProvider';

async function fetchBotProfilePhoto(provider: BotApiProvider, userId: string): Promise<string | null> {
  try {
    const photos = await provider.callApi('getUserProfilePhotos', { user_id: userId, limit: 1 });
    if (photos.total_count > 0 && photos.photos[0].length > 0) {
      const fileId = photos.photos[0][0].file_id;
      const fileObj = await provider.callApi('getFile', { file_id: fileId });
      
      // We need the bot token to construct the file URL
      const tokenMatch = provider['apiUrl'].match(/bot(.*?)$/);
      if (tokenMatch) {
        const token = tokenMatch[1];
        const fileUrl = `https://api.telegram.org/file/bot${token}/${fileObj.file_path}`;
        
        const res = await fetch(fileUrl);
        const buffer = await res.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return `data:image/jpeg;base64,${base64}`;
      }
    }
  } catch (e) {
    console.warn("Could not download bot profile photo:", e);
  }
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let authInstanceId = undefined;
  try {
    if (typeof params !== 'undefined') {
      const p = await params;
      authInstanceId = (p as any).instanceId || (p as any).id;
    }
  } catch(e) {}
  if (!(await checkAuth(req, authInstanceId))) return unauthorizedResponse();

  try {
    const { id } = await params;
    const instance = await prisma.instance.findUnique({ where: { id } });

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (instance.type === 'BOT') {
      const provider = await ProviderFactory.getProvider(instance) as BotApiProvider;
      
      // Fetch bot info
      const me = await provider.callApi('getMe', {});
      const botPhoto = await fetchBotProfilePhoto(provider, me.id);

      const botInfo = {
        id: me.id.toString(),
        firstName: me.first_name || '',
        username: me.username || '',
        photo: botPhoto
      };

      let businessInfo = null;

      if (instance.botType === 'BUSINESS' && instance.businessConnectionId) {
        try {
          // getBusinessConnection API call expects business_connection_id natively,
          // but our callApi auto-injects it, so we don't need to pass it explicitly in body.
          // Wait, getBusinessConnection expects business_connection_id explicitly.
          // Our callApi injects it into body.business_connection_id automatically!
          const conn = await provider.callApi('getBusinessConnection', { business_connection_id: instance.businessConnectionId });
          const bUser = conn.user;
          const bPhoto = await fetchBotProfilePhoto(provider, bUser.id);
          
          businessInfo = {
            id: bUser.id.toString(),
            firstName: bUser.first_name || '',
            username: bUser.username || '',
            photo: bPhoto
          };
        } catch (e) {
          console.warn("Could not fetch business connection info:", e);
        }
      }

      return NextResponse.json({
        type: 'BOT',
        botType: instance.botType,
        botInfo,
        businessInfo,
        // Fill base fields with Bot info to avoid breaking older UI components momentarily
        id: me.id.toString(),
        firstName: me.first_name || '',
        username: me.username || '',
        photo: botPhoto,
        phone: '',
        totalChats: 0,
        unreadMessages: 0
      });
    }

    // Check if client is initialized
    if (!telegramManager.hasClient(id)) {
      return NextResponse.json({ error: 'Client not connected' }, { status: 400 });
    }

    const client = await telegramManager.getClient(id);
    
    // Check if truly connected
    if (!client.connected) {
      return NextResponse.json({ error: 'Client not connected' }, { status: 400 });
    }

    const me = await client.getMe() as Api.User;
    
    if (!me) {
      return NextResponse.json({ error: 'Could not fetch profile' }, { status: 400 });
    }

    // Try to get profile photo
    let photoBase64 = null;
    try {
      const buffer = await client.downloadProfilePhoto("me", { isBig: false });
      if (buffer && buffer.length > 0) {
        photoBase64 = buffer.toString('base64');
      }
    } catch (e) {
      console.warn("Could not download profile photo:", e);
    }

    // Fetch fast metrics using Telegram API
    let totalChats = 0;
    let unreadMessages = 0;

    try {
      // Get global unread messages count instantly
      const state = await client.invoke(new Api.updates.GetState()) as any;
      unreadMessages = state.unreadCount || 0;

      // Get total dialogs count instantly by fetching only 1 dialog
      const dialogsReq = await client.invoke(new Api.messages.GetDialogs({
        offsetDate: 0,
        offsetId: 0,
        offsetPeer: new Api.InputPeerEmpty(),
        limit: 1,
        hash: 0 as any
      })) as any;
      
      totalChats = dialogsReq.count || (dialogsReq.dialogs ? dialogsReq.dialogs.length : 0);
    } catch (e) {
      console.warn("Could not fetch fast metrics:", e);
    }

    return NextResponse.json({
      type: 'USER',
      id: me.id.toString(),
      firstName: me.firstName || '',
      lastName: me.lastName || '',
      username: me.username || '',
      phone: me.phone || '',
      photo: photoBase64 ? `data:image/jpeg;base64,${photoBase64}` : null,
      totalChats,
      unreadMessages
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
