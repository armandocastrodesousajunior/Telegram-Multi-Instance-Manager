import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string, webhookId: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { webhookId } = await params;
    const body = await req.json();
    const { active } = body;

    const webhook = await prisma.webhook.update({
      where: { id: webhookId },
      data: { active }
    });

    return NextResponse.json(webhook);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
