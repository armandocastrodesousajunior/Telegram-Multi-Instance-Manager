import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { id } = await params;
    const settings = await prisma.instanceSettings.findUnique({
      where: { instanceId: id }
    });

    if (!settings) return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await req.json();

    const settings = await prisma.instanceSettings.update({
      where: { instanceId: id },
      data: body
    });

    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
