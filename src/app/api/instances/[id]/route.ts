import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { telegramManager } from '@/lib/telegram/client';
import { invalidateInstanceSettingsCache, invalidateWebhooksCache } from '@/lib/telegram/utils';
import { getInstanceLiveStatus, invalidateInstanceStatusCache } from '@/lib/telegram/status';

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
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    const instance = await prisma.instance.findUnique({
      where: { id },
      include: { settings: true, webhooks: true }
    });

    if (!instance) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const liveStatus = await getInstanceLiveStatus(instance, forceRefresh);
    const { session, ...safeInstance } = instance;
    return NextResponse.json({
      ...safeInstance,
      status: liveStatus
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    
    // Disconnect if needed
    if (telegramManager.hasClient(id)) {
      await telegramManager.removeClient(id);
    }

    await prisma.instance.delete({
      where: { id }
    });

    await Promise.all([
      invalidateInstanceSettingsCache(id),
      invalidateWebhooksCache(id),
      invalidateInstanceStatusCache(id)
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    
    const dataToUpdate: any = {};
    if (typeof body.name === 'string' && body.name.trim()) {
      dataToUpdate.name = body.name.trim();
    }
    if (typeof body.language === 'string' && body.language.trim()) {
      dataToUpdate.language = body.language.trim();
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided (name or language required)' }, { status: 400 });
    }

    const updated = await prisma.instance.update({
      where: { id },
      data: dataToUpdate
    });

    invalidateInstanceSettingsCache(id);

    const { session, ...safeUpdated } = updated;
    return NextResponse.json(safeUpdated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const PUT = PATCH;

