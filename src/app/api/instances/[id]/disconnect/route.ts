import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { telegramManager } from '@/lib/telegram/client';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { id } = await params;
    const instance = await prisma.instance.findUnique({ where: { id } });
    if (!instance) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await telegramManager.removeClient(id);

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
