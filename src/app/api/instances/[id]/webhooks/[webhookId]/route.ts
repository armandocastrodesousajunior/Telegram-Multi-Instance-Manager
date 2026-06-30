import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string, webhookId: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { webhookId } = await params;
    const body = await req.json();
    
    const dataToUpdate: any = {};
    if (body.name !== undefined) dataToUpdate.name = body.name;
    if (body.url !== undefined) dataToUpdate.url = body.url;
    if (body.events !== undefined) dataToUpdate.events = JSON.stringify(body.events);
    if (body.active !== undefined) dataToUpdate.active = body.active;
    if (body.includeOutgoing !== undefined) dataToUpdate.includeOutgoing = body.includeOutgoing;

    const webhook = await prisma.webhook.update({
      where: { id: webhookId },
      data: dataToUpdate
    });

    return NextResponse.json({ ...webhook, events: JSON.parse(webhook.events) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string, webhookId: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { webhookId } = await params;
    
    await prisma.webhook.delete({
      where: { id: webhookId }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
