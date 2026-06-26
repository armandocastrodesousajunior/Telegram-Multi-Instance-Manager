import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const instances = await prisma.instance.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(instances);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const instance = await prisma.instance.create({
      data: {
        name,
        status: 'disconnected',
        settings: {
          create: {}
        }
      }
    });

    return NextResponse.json(instance);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
