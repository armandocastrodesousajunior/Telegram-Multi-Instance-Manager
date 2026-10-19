import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  if (!(await checkAuth(req))) return unauthorizedResponse();

  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(5, parseInt(url.searchParams.get('limit') || '25', 10)));
    const skip = (page - 1) * limit;

    const type = (url.searchParams.get('type') || 'all').toLowerCase(); // 'all' | 'api' | 'webhook'
    const level = (url.searchParams.get('level') || 'all').toLowerCase(); // 'all' | 'error' | 'alert' | 'info'
    const instanceId = url.searchParams.get('instanceId') || 'all';
    const search = (url.searchParams.get('search') || '').trim();

    // 1. Busca instâncias para o dropdown de filtro
    const instances = await prisma.instance.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });

    // 2. Filtros base do Prisma
    const apiWhere: any = {};
    const webhookWhere: any = {};

    if (instanceId !== 'all') {
      apiWhere.instanceId = instanceId;
      webhookWhere.instanceId = instanceId;
    }

    if (search) {
      apiWhere.OR = [
        { endpoint: { contains: search, mode: 'insensitive' } },
        { method: { contains: search, mode: 'insensitive' } },
        { responseBody: { contains: search, mode: 'insensitive' } },
        { requestBody: { contains: search, mode: 'insensitive' } },
        { instance: { name: { contains: search, mode: 'insensitive' } } }
      ];

      webhookWhere.OR = [
        { event: { contains: search, mode: 'insensitive' } },
        { targetUrl: { contains: search, mode: 'insensitive' } },
        { responseBody: { contains: search, mode: 'insensitive' } },
        { requestPayload: { contains: search, mode: 'insensitive' } },
        { instance: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Filtros de nível (Level)
    if (level === 'error') {
      apiWhere.OR = [
        { responseStatus: { gte: 500 } },
        { success: false }
      ];
      webhookWhere.success = false;
      webhookWhere.NOT = {
        responseBody: { contains: '"alertType":"RETRY_ATTEMPT"' }
      };
    } else if (level === 'alert') {
      apiWhere.OR = [
        { responseStatus: { gte: 400, lt: 500 } },
        { responseStatus: 429 }
      ];
      webhookWhere.OR = [
        { responseBody: { contains: '"alertType":"RETRY_ATTEMPT"' } },
        { responseBody: { contains: '"alertType":"RETRY_RECOVERED"' } },
        { responseStatus: 429 },
        { responseStatus: 408 }
      ];
    } else if (level === 'info') {
      apiWhere.success = true;
      apiWhere.responseStatus = { gte: 200, lt: 400 };
      webhookWhere.success = true;
      webhookWhere.NOT = {
        responseBody: { contains: '"alertType":"RETRY_RECOVERED"' }
      };
    }

    // 3. Execução das queries
    let apiLogsRaw: any[] = [];
    let webhookLogsRaw: any[] = [];
    let apiCount = 0;
    let webhookCount = 0;

    const shouldQueryApi = type === 'all' || type === 'api';
    const shouldQueryWebhook = type === 'all' || type === 'webhook';

    const queries: Promise<any>[] = [];

    if (shouldQueryApi) {
      queries.push(
        prisma.apiLog.count({ where: apiWhere }).then(c => { apiCount = c; }),
        prisma.apiLog.findMany({
          where: apiWhere,
          include: { instance: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          skip: type === 'api' ? skip : 0,
          take: type === 'api' ? limit : Math.min(skip + limit, 150)
        }).then(rows => { apiLogsRaw = rows; })
      );
    }

    if (shouldQueryWebhook) {
      queries.push(
        prisma.webhookLog.count({ where: webhookWhere }).then(c => { webhookCount = c; }),
        prisma.webhookLog.findMany({
          where: webhookWhere,
          include: { instance: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          skip: type === 'webhook' ? skip : 0,
          take: type === 'webhook' ? limit : Math.min(skip + limit, 150)
        }).then(rows => { webhookLogsRaw = rows; })
      );
    }

    await Promise.all(queries);

    // 4. Mapeamento e Normalização para formato unificado
    const normalizedApiLogs = apiLogsRaw.map(log => {
      let reqBody: any = log.requestBody;
      let resBody: any = log.responseBody;
      try { reqBody = log.requestBody ? JSON.parse(log.requestBody) : null; } catch {}
      try { resBody = log.responseBody ? JSON.parse(log.responseBody) : null; } catch {}

      let computedLevel: 'ERROR' | 'ALERT' | 'INFO' = 'INFO';
      if (log.responseStatus >= 500 || (!log.success && log.responseStatus === 0)) {
        computedLevel = 'ERROR';
      } else if (log.responseStatus >= 400 && log.responseStatus < 500) {
        computedLevel = 'ALERT';
      }

      return {
        id: log.id,
        type: 'API' as const,
        level: computedLevel,
        instanceId: log.instanceId,
        instanceName: log.instance?.name || 'Instância Removida',
        endpointOrEvent: log.endpoint,
        methodOrTarget: log.method,
        status: log.responseStatus,
        success: log.success,
        requestPayload: reqBody,
        responseBody: resBody,
        createdAt: log.createdAt.toISOString(),
      };
    });

    const normalizedWebhookLogs = webhookLogsRaw.map(log => {
      let reqBody: any = log.requestPayload;
      let resBody: any = log.responseBody;
      try { reqBody = log.requestPayload ? JSON.parse(log.requestPayload) : null; } catch {}
      try { resBody = log.responseBody ? JSON.parse(log.responseBody) : null; } catch {}

      let computedLevel: 'ERROR' | 'ALERT' | 'INFO' = 'INFO';
      let retryInfo: any = undefined;

      const isRetryAttempt = resBody && resBody.alertType === 'RETRY_ATTEMPT';
      const isRetryRecovered = resBody && resBody.alertType === 'RETRY_RECOVERED';

      if (isRetryAttempt) {
        computedLevel = 'ALERT';
        retryInfo = {
          isRetry: true,
          attempt: resBody.attempt,
          maxRetries: resBody.maxRetries,
          delayMs: resBody.delayMs,
          message: resBody.message
        };
      } else if (isRetryRecovered) {
        computedLevel = 'ALERT';
        retryInfo = {
          isRetry: true,
          recovered: true,
          attempt: resBody.attempt,
          message: resBody.message
        };
      } else if (log.responseStatus === 429 || log.responseStatus === 408) {
        computedLevel = 'ALERT';
      } else if (!log.success) {
        computedLevel = 'ERROR';
      }

      return {
        id: log.id,
        type: 'WEBHOOK' as const,
        level: computedLevel,
        instanceId: log.instanceId,
        instanceName: log.instance?.name || 'Instância Removida',
        endpointOrEvent: log.event,
        methodOrTarget: log.targetUrl,
        status: log.responseStatus,
        success: log.success,
        requestPayload: reqBody,
        responseBody: resBody,
        createdAt: log.createdAt.toISOString(),
        retryInfo
      };
    });

    // 5. Unificação e ordenação
    let allLogs: any[] = [];
    if (type === 'api') {
      allLogs = normalizedApiLogs;
    } else if (type === 'webhook') {
      allLogs = normalizedWebhookLogs;
    } else {
      allLogs = [...normalizedApiLogs, ...normalizedWebhookLogs].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }).slice(skip, skip + limit);
    }

    const total = type === 'api' ? apiCount : type === 'webhook' ? webhookCount : (apiCount + webhookCount);

    // 6. Estatísticas rápidas
    const [globalErrors, globalWebhooksRetried] = await Promise.all([
      prisma.apiLog.count({ where: { OR: [{ responseStatus: { gte: 500 } }, { success: false }] } }).catch(() => 0),
      prisma.webhookLog.count({ where: { responseBody: { contains: '"alertType":"RETRY_ATTEMPT"' } } }).catch(() => 0)
    ]);

    return NextResponse.json({
      logs: allLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      },
      stats: {
        totalLogs: apiCount + webhookCount,
        apiCount,
        webhookCount,
        globalErrors,
        globalWebhooksRetried
      },
      instances
    });

  } catch (err: any) {
    console.error('[API /api/logs] Erro ao carregar logs:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAuth(req))) return unauthorizedResponse();

  try {
    const url = new URL(req.url);
    const instanceId = url.searchParams.get('instanceId');

    if (instanceId && instanceId !== 'all') {
      await Promise.all([
        prisma.apiLog.deleteMany({ where: { instanceId } }),
        prisma.webhookLog.deleteMany({ where: { instanceId } })
      ]);
    } else {
      await Promise.all([
        prisma.apiLog.deleteMany({}),
        prisma.webhookLog.deleteMany({})
      ]);
    }

    return NextResponse.json({ success: true, message: 'Logs limpos com sucesso' });
  } catch (err: any) {
    console.error('[API /api/logs DELETE] Erro ao limpar logs:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
