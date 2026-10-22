import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getInstanceLiveStatus } from '@/lib/telegram/status';

export async function GET(req: NextRequest) {
  if (!(await checkAuth(req))) return unauthorizedResponse();

  try {
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    const instances = await prisma.instance.findMany({
      select: {
        id: true,
        name: true,
        language: true,
        type: true,
        botType: true,
        botToken: true,
        businessConnectionId: true,
        phone: true,
        status: true,
        token: true,
        createdAt: true,
        session: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    // Consulta os status reais em tempo real (Telegram Bot API / GramJS) em paralelo
    const instancesWithLiveStatus = await Promise.all(
      instances.map(async (inst) => {
        const liveStatus = await getInstanceLiveStatus(inst, forceRefresh);
        const { session, ...safeInst } = inst;
        return {
          ...safeInst,
          status: liveStatus
        };
      })
    );

    return NextResponse.json(instancesWithLiveStatus);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth(req))) return unauthorizedResponse();

  try {
    const { name, type, botType, botToken, language } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (type === 'BOT' && !botToken) {
      return NextResponse.json({ error: 'Bot token is required for Bot instances' }, { status: 400 });
    }

    const instance = await prisma.instance.create({
      data: {
        name,
        language: typeof language === 'string' && language.trim() ? language.trim() : 'pt-BR',
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
