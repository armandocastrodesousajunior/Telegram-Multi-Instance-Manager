import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { telegramManager } from '@/lib/telegram/client';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (instance.type === 'BOT') {
      if (!instance.botToken) return NextResponse.json({ error: 'Bot token missing' }, { status: 400 });

      const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
      const webhookUrl = `${baseUrl}/api/webhooks/bot/${instance.id}`;
      
      const res = await fetch(`https://api.telegram.org/bot${instance.botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "edited_message", "business_connection", "business_message"] })
      });
      
      const data = await res.json();
      if (!data.ok) {
        return NextResponse.json({ error: `Failed to set webhook: ${data.description}` }, { status: 500 });
      }
    } else {
      if (!instance.session) {
        return NextResponse.json({ error: 'Instance not authenticated yet' }, { status: 400 });
      }
      await telegramManager.getClient(id);
    }
    
    await prisma.instance.update({
      where: { id },
      data: { status: 'connected' }
    });

    return NextResponse.json({ success: true, status: 'connected' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
