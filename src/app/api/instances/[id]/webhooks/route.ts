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

    const instance = await prisma.instance.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name, url, events, includeOutgoing = true } = body;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ error: 'Webhook URL is required and must be a string' }, { status: 400 });
    }

    const webhookEvents = Array.isArray(events) && events.length > 0 ? events : ['message'];
    const webhookName = (typeof name === 'string' && name.trim()) ? name.trim() : 'Webhook ' + url.trim();

    const webhook = await prisma.webhook.create({
      data: {
        instanceId: id,
        name: webhookName,
        url: url.trim(),
        events: JSON.stringify(webhookEvents),
        includeOutgoing: Boolean(includeOutgoing)
      }
    });

    return NextResponse.json({ ...webhook, events: JSON.parse(webhook.events) }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
