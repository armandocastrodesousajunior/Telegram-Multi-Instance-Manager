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
      if (instance.botToken) {
        try {
          await fetch(`https://api.telegram.org/bot${instance.botToken}/deleteWebhook`, { method: 'POST' });
        } catch (e) {
          console.error('[Disconnect] Failed to delete bot webhook', e);
        }
      }
    } else {
      await telegramManager.removeClient(id);
    }

    await prisma.instance.update({
      where: { id },
      data: { status: 'disconnected' }
    });

    await prisma.connectionAudit.create({
      data: {
        instanceId: id,
        event: 'DISCONNECT',
        phone: instance.phone
      }
    });

    return NextResponse.json({ success: true, status: 'disconnected' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
