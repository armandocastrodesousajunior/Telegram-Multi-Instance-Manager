import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { telegramManager } from '@/lib/telegram/client';
import { Api } from 'telegram';
import { StringSession } from 'telegram/sessions';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await req.json();
    const { phoneCodeHash, code, password } = body;

    const instance = await prisma.instance.findUnique({ where: { id } });
    if (!instance) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });

    const client = await telegramManager.getClient(id);

    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: instance.phone || '',
          phoneCodeHash,
          phoneCode: code
        })
      );
    } catch (e: any) {
      if (e.message.includes('SESSION_PASSWORD_NEEDED') && password) {
         const { computeCheck } = await import('telegram/Password.js');
         const passwordInfo = await client.invoke(new Api.account.GetPassword());
         await client.invoke(
            new Api.auth.CheckPassword({
                password: await computeCheck(passwordInfo, password)
            })
         );
      } else {
        throw e;
      }
    }

    const sessionStr = (client.session as StringSession).save();

    await prisma.instance.update({
      where: { id },
      data: {
        session: sessionStr as unknown as string,
        status: 'connected'
      }
    });

    await prisma.connectionAudit.create({
      data: {
        instanceId: id,
        event: 'CONNECT',
        phone: instance.phone
      }
    });

    return NextResponse.json({ success: true, status: 'connected' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
