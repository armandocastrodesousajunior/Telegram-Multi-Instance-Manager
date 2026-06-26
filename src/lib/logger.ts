import { prisma } from './db';

// Default retention days
const DEFAULT_API_RETENTION = 30;
const DEFAULT_WEBHOOK_RETENTION = 30;

export async function logApiRequest(data: {
  instanceId: string;
  endpoint: string;
  method: string;
  requestBody?: any;
  responseStatus: number;
  responseBody?: any;
  success: boolean;
}) {
  try {
    // Fire and forget insertion
    await prisma.apiLog.create({
      data: {
        instanceId: data.instanceId,
        endpoint: data.endpoint,
        method: data.method,
        requestBody: data.requestBody ? JSON.stringify(data.requestBody) : null,
        responseStatus: data.responseStatus,
        responseBody: data.responseBody ? JSON.stringify(data.responseBody) : null,
        success: data.success
      }
    });

    // Cleanup old logs asynchronously
    cleanupApiLogs(data.instanceId).catch(err => console.error("Failed to cleanup API logs", err));
  } catch (err) {
    console.error("Failed to log API request:", err);
  }
}

export async function logWebhookEvent(data: {
  instanceId: string;
  webhookId?: string;
  event: string;
  targetUrl: string;
  requestPayload?: any;
  responseStatus?: number;
  responseBody?: any;
  success: boolean;
}) {
  try {
    await prisma.webhookLog.create({
      data: {
        instanceId: data.instanceId,
        webhookId: data.webhookId,
        event: data.event,
        targetUrl: data.targetUrl,
        requestPayload: data.requestPayload ? JSON.stringify(data.requestPayload) : null,
        responseStatus: data.responseStatus,
        responseBody: data.responseBody ? JSON.stringify(data.responseBody) : null,
        success: data.success
      }
    });

    // Cleanup old logs asynchronously
    cleanupWebhookLogs(data.instanceId).catch(err => console.error("Failed to cleanup Webhook logs", err));
  } catch (err) {
    console.error("Failed to log Webhook event:", err);
  }
}

async function cleanupApiLogs(instanceId: string) {
  const days = parseInt(process.env.API_LOGS_RETENTION_DAYS || `${DEFAULT_API_RETENTION}`, 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  await prisma.apiLog.deleteMany({
    where: {
      instanceId,
      createdAt: { lt: cutoffDate }
    }
  });
}

async function cleanupWebhookLogs(instanceId: string) {
  const days = parseInt(process.env.WEBHOOK_LOGS_RETENTION_DAYS || `${DEFAULT_WEBHOOK_RETENTION}`, 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  await prisma.webhookLog.deleteMany({
    where: {
      instanceId,
      createdAt: { lt: cutoffDate }
    }
  });
}
