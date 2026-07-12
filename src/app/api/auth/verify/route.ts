import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!(await checkAuth(req))) return unauthorizedResponse();

  return NextResponse.json({ success: true, message: 'Authenticated' });
}
