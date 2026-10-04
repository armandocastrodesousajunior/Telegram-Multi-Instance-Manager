import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './db';
import { getCachedInstance } from './telegram/utils';

export function extractToken(req: NextRequest): string | null {
  const xToken = req.headers.get('x-access-token');
  if (xToken) return xToken.trim();

  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    return authHeader.replace(/^Bearer\s+/i, '').trim();
  }
  return null;
}

export function checkAdminToken(token: string | null): boolean {
  if (!token || !process.env.ACCESS_TOKEN) return false;
  return token === process.env.ACCESS_TOKEN.trim();
}

export async function checkAdminAuth(req: NextRequest): Promise<boolean> {
  const token = extractToken(req);
  return checkAdminToken(token);
}

export async function checkAuth(req: NextRequest, instanceId?: string): Promise<boolean> {
  const token = extractToken(req);
  if (!token) return false;

  // Master Access Token configurado no .env
  if (checkAdminToken(token)) return true;

  // Token específico da instância
  if (instanceId) {
    try {
      const instance = await getCachedInstance(instanceId);
      if (instance && instance.token === token) return true;
    } catch (e) {
      console.error('[checkAuth] Erro ao buscar instância:', e);
    }
  }

  return false;
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

