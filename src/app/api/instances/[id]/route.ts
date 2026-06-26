import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { telegramManager } from '@/lib/telegram/client';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { id } = await params;
    const instance = await prisma.instance.findUnique({
      where: { id },
      include: { settings: true, webhooks: true }
    });

    if (!instance) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(instance);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { id } = await params;
    
    // Disconnect if needed
    if (telegramManager.hasClient(id)) {
      await telegramManager.removeClient(id);
    }

    await prisma.instance.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
