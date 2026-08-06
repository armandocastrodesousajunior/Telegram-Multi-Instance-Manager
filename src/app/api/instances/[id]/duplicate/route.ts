import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAuth(req))) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const originalInstance = await prisma.instance.findUnique({
      where: { id },
      include: {
        settings: true,
        webhooks: true
      }
    });

    if (!originalInstance) {
      return NextResponse.json({ error: 'Original instance not found' }, { status: 404 });
    }

    // Prepare settings to copy (exclude id and instanceId)
    const { id: _settingsId, instanceId: _settingsInstanceId, ...settingsToCopy } = originalInstance.settings || {} as any;

    const newInstance = await prisma.instance.create({
      data: {
        name,
        type: originalInstance.type,
        botType: originalInstance.botType,
        botToken: originalInstance.botToken, // Copied, but status will be disconnected
        status: 'disconnected',
        settings: {
          create: Object.keys(settingsToCopy).length > 0 ? settingsToCopy : {}
        },
        webhooks: {
          create: originalInstance.webhooks.map(wh => ({
            name: wh.name,
            url: wh.url,
            events: wh.events,
            active: wh.active,
            includeOutgoing: wh.includeOutgoing
          }))
        }
      },
      include: {
        settings: true,
        webhooks: true
      }
    });

    return NextResponse.json(newInstance);
  } catch (err: any) {
    console.error('[Duplicate Instance]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
