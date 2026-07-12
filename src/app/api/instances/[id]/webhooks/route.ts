import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
    const webhooks = await prisma.webhook.findMany({
      where: { instanceId: id }
    });

    const parsedWebhooks = webhooks.map((wh) => ({
      ...wh,
      events: JSON.parse(wh.events)
    }));

    return NextResponse.json(parsedWebhooks);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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
    const body = await req.json();
    const { name, url, events, includeOutgoing = true } = body;

    const webhook = await prisma.webhook.create({
      data: {
        instanceId: id,
        name,
        url,
        events: JSON.stringify(events),
        includeOutgoing
      }
    });

    return NextResponse.json({ ...webhook, events: JSON.parse(webhook.events) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
