import { NextRequest, NextResponse } from 'next/server';

export function checkAuth(req: NextRequest): boolean {
  const token = req.headers.get('x-access-token') || req.headers.get('authorization')?.replace('Bearer ', '');
  return token === process.env.ACCESS_TOKEN;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
