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

    // 2. Condições base (escopo da instância e busca)
    const baseApiConditions: any[] = [];
    const baseWebhookConditions: any[] = [];

    if (instanceId !== 'all') {
      baseApiConditions.push({ instanceId });
      baseWebhookConditions.push({ instanceId });
    }

    if (search) {
      baseApiConditions.push({
        OR: [
          { endpoint: { contains: search, mode: 'insensitive' } },
          { method: { contains: search, mode: 'insensitive' } },
          { responseBody: { contains: search, mode: 'insensitive' } },
          { requestBody: { contains: search, mode: 'insensitive' } },
          { instance: { name: { contains: search, mode: 'insensitive' } } }
        ]
      });

      baseWebhookConditions.push({
        OR: [
          { event: { contains: search, mode: 'insensitive' } },
          { targetUrl: { contains: search, mode: 'insensitive' } },
          { responseBody: { contains: search, mode: 'insensitive' } },
          { requestPayload: { contains: search, mode: 'insensitive' } },
          { instance: { name: { contains: search, mode: 'insensitive' } } }
        ]
      });
    }

    // Definições de filtros por nível
    const apiErrorFilter = {
      OR: [
        { responseStatus: { gte: 500 } },
        { success: false, responseStatus: { lt: 400 } },
        { success: false, responseStatus: 0 }
      ]
    };
    const apiAlertFilter = {
      OR: [
        { responseStatus: { gte: 400, lt: 500 } },
        { responseStatus: 429 }
      ]
    };
    const apiInfoFilter = {
      success: true,
      responseStatus: { gte: 200, lt: 400 }
    };

    const webhookErrorFilter = {
      success: false,
      NOT: [
        { responseBody: { contains: '"alertType":"RETRY_ATTEMPT"' } },
        { responseBody: { contains: '"alertType":"RETRY_RECOVERED"' } },
        { responseStatus: 429 },
        { responseStatus: 408 }
      ]
    };
    const webhookAlertFilter = {
      OR: [
        { responseBody: { contains: '"alertType":"RETRY_ATTEMPT"' } },
        { responseBody: { contains: '"alertType":"RETRY_RECOVERED"' } },
        { responseStatus: 429 },
        { responseStatus: 408 }
      ]
    };
    const webhookInfoFilter = {
      success: true,
      NOT: {
        responseBody: { contains: '"alertType":"RETRY_RECOVERED"' }
      }
    };

    // Condições ativas para listagem da tabela
    const activeApiConditions = [...baseApiConditions];
    const activeWebhookConditions = [...baseWebhookConditions];

    if (level === 'error') {
      activeApiConditions.push(apiErrorFilter);
      activeWebhookConditions.push(webhookErrorFilter);
    } else if (level === 'alert') {
      activeApiConditions.push(apiAlertFilter);
      activeWebhookConditions.push(webhookAlertFilter);
    } else if (level === 'info') {
      activeApiConditions.push(apiInfoFilter);
      activeWebhookConditions.push(webhookInfoFilter);
    }

    const apiWhere = activeApiConditions.length > 0 ? { AND: activeApiConditions } : {};
    const webhookWhere = activeWebhookConditions.length > 0 ? { AND: activeWebhookConditions } : {};
    const baseApiWhere = baseApiConditions.length > 0 ? { AND: baseApiConditions } : {};
    const baseWebhookWhere = baseWebhookConditions.length > 0 ? { AND: baseWebhookConditions } : {};

    // 3. Execução das queries para listagem
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
          take: type === 'api' ? limit : skip + limit
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
          take: type === 'webhook' ? limit : skip + limit
        }).then(rows => { webhookLogsRaw = rows; })
      );
    }

    // 4. Estatísticas globais/escopo (Erros Críticos, Alertas & Retries, API, Webhook)
    let totalApiCount = 0;
    let totalWebhookCount = 0;
    let apiErrors = 0;
    let webhookErrors = 0;
    let apiAlerts = 0;
    let webhookAlerts = 0;

    queries.push(
      prisma.apiLog.count({ where: baseApiWhere }).then(c => { totalApiCount = c; }).catch(() => 0),
      prisma.webhookLog.count({ where: baseWebhookWhere }).then(c => { totalWebhookCount = c; }).catch(() => 0),
      prisma.apiLog.count({ where: { AND: [...baseApiConditions, apiErrorFilter] } }).then(c => { apiErrors = c; }).catch(() => 0),
      prisma.webhookLog.count({ where: { AND: [...baseWebhookConditions, webhookErrorFilter] } }).then(c => { webhookErrors = c; }).catch(() => 0),
      prisma.apiLog.count({ where: { AND: [...baseApiConditions, apiAlertFilter] } }).then(c => { apiAlerts = c; }).catch(() => 0),
      prisma.webhookLog.count({ where: { AND: [...baseWebhookConditions, webhookAlertFilter] } }).then(c => { webhookAlerts = c; }).catch(() => 0)
    );

    await Promise.all(queries);

    const globalErrors = apiErrors + webhookErrors;
    const globalWebhooksRetried = apiAlerts + webhookAlerts;

    // 5. Mapeamento e Normalização para formato unificado
    const normalizedApiLogs = apiLogsRaw.map(log => {
      let reqBody: any = log.requestBody;
      let resBody: any = log.responseBody;
      try { reqBody = log.requestBody ? JSON.parse(log.requestBody) : null; } catch {}
      try { resBody = log.responseBody ? JSON.parse(log.responseBody) : null; } catch {}

      let computedLevel: 'ERROR' | 'ALERT' | 'INFO' = 'INFO';
      if (log.responseStatus >= 500 || (!log.success && (log.responseStatus === 0 || log.responseStatus < 400))) {
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

    // 6. Unificação e ordenação
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

    return NextResponse.json({
      logs: allLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      },
      stats: {
        totalLogs: totalApiCount + totalWebhookCount,
        apiCount: totalApiCount,
        webhookCount: totalWebhookCount,
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
