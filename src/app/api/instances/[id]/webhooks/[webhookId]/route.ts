import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { invalidateWebhooksCache } from '@/lib/telegram/utils';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string, webhookId: string }> }) {
  let authInstanceId = undefined;
  try {
    if (typeof params !== 'undefined') {
      const p = await params;
      authInstanceId = (p as any).instanceId || (p as any).id;
    }
  } catch(e) {}
  if (!(await checkAuth(req, authInstanceId))) return unauthorizedResponse();

  try {
    const { id, webhookId } = await params;
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

    if (id) {
      await invalidateWebhooksCache(id);
    }

    return NextResponse.json({ ...webhook, events: JSON.parse(webhook.events) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string, webhookId: string }> }) {
  let authInstanceId = undefined;
  try {
    if (typeof params !== 'undefined') {
      const p = await params;
      authInstanceId = (p as any).instanceId || (p as any).id;
    }
  } catch(e) {}
  if (!(await checkAuth(req, authInstanceId))) return unauthorizedResponse();

  try {
    const { id, webhookId } = await params;
    
    await prisma.webhook.delete({
      where: { id: webhookId }
    });

    if (id) {
      await invalidateWebhooksCache(id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
