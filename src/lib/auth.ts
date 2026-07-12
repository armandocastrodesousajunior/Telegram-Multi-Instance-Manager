import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './db';

export async function checkAuth(req: NextRequest, instanceId?: string): Promise<boolean> {
  const token = req.headers.get('x-access-token') || req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return false;

  // Token global
  if (token === process.env.ACCESS_TOKEN) return true;

  // Token da instância específica
  if (instanceId) {
    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId },
        select: { token: true }
      });
      if (instance && instance.token === token) return true;
    } catch (e) {
      console.error('[checkAuth] Erro ao buscar instância:', e);
    }
  }

  return false;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
