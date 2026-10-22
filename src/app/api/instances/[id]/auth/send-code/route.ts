import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { telegramManager } from '@/lib/telegram/client';
import { invalidateInstanceStatusCache } from '@/lib/telegram/status';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let authInstanceId = undefined;
  try {
    if (typeof params !== 'undefined') {
      const p = await params;
      authInstanceId = (p as any).instanceId || (p as any).id;
    }
  } catch(e) {}
  if (!(await checkAuth(req, authInstanceId))) return unauthorizedResponse();

  try {
    const { id } = await params;
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 });
    }

    const instance = await prisma.instance.findUnique({ where: { id } });
    
    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    // Atualiza o telefone no banco e limpa a sessão antiga invalidada
    await prisma.instance.update({
      where: { id },
      data: {
        phone,
        session: null,
        status: 'disconnected'
      }
    });

    await invalidateInstanceStatusCache(id);

    // Cria um cliente MTProto completamente limpo com StringSession vazia
    const client = await telegramManager.createAuthClient(id);

    const apiId = parseInt(process.env.TELEGRAM_API_ID || '0', 10);
    const apiHash = process.env.TELEGRAM_API_HASH || '';

    try {
      const { phoneCodeHash } = await client.sendCode(
        { apiId, apiHash },
        phone
      );

      return NextResponse.json({ success: true, phoneCodeHash });
    } catch (sendErr: any) {
      await telegramManager.removeClient(id).catch(() => {});
      throw sendErr;
    }
  } catch (err: any) {
    console.error(`[send-code] Erro ao enviar código de autenticação:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
