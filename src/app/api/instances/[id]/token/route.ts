import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Allow global token or instance token (although instance token is about to be revoked)
  let authInstanceId = undefined;
  try {
    const p = await params;
    authInstanceId = p.id;
  } catch(e) {}
  
  if (!(await checkAuth(req, authInstanceId))) return unauthorizedResponse();

  try {
    const { id } = await params;
    const newToken = crypto.randomUUID();

    const instance = await prisma.instance.update({
      where: { id },
      data: { token: newToken },
    });

    return NextResponse.json({ success: true, token: instance.token });
  } catch (error: any) {
    console.error('Error revoking token:', error);
    return NextResponse.json({ error: 'Failed to revoke token' }, { status: 500 });
  }
}
