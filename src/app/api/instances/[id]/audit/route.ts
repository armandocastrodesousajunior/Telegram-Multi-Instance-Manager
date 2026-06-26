import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { id } = await params;
    
    const audits = await prisma.connectionAudit.findMany({
      where: { instanceId: id },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit to recent 50 logs
    });

    return NextResponse.json(audits);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
