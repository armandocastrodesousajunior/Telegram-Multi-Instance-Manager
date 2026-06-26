import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { telegramManager } from '@/lib/telegram/client';
import { Api } from 'telegram';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { id } = await params;

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
