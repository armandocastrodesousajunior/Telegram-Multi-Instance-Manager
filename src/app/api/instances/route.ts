import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  if (!(await checkAuth(req))) return unauthorizedResponse();

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
  if (!(await checkAuth(req))) return unauthorizedResponse();

  try {
    const { name, type, botType, botToken } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (type === 'BOT' && !botToken) {
      return NextResponse.json({ error: 'Bot token is required for Bot instances' }, { status: 400 });
    }

    const instance = await prisma.instance.create({
      data: {
        name,
        type: type || 'USER',
        botType: botType || null,
        botToken: botToken || null,
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
