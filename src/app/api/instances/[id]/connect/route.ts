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

    if (!instance.session) {
      return NextResponse.json({ error: 'Instance not authenticated yet' }, { status: 400 });
    }

    await telegramManager.getClient(id);
    
    await prisma.instance.update({
      where: { id },
      data: { status: 'connected' }
    });

    return NextResponse.json({ success: true, status: 'connected' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
