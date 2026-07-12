import { prisma } from '../db';
import { logWebhookEvent } from '../logger';

export async function dispatchWebhook(instanceId: string, eventName: string, payload: any) {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        instanceId,
        active: true,
      },
    });

    const instanceObj = await prisma.instance.findUnique({
      where: { id: instanceId },
      select: { token: true }
    });

    const endpoint = process.env.PUBLIC_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    for (const webhook of webhooks) {
      let events: string[] = [];
      try {
        events = JSON.parse(webhook.events);
      } catch (e) {
        continue;
      }
      
      if (events.includes(eventName) || events.includes('*')) {
        // Filter outgoing messages if webhook has includeOutgoing = false
        if (!webhook.includeOutgoing && payload?.isOutgoing) {
          continue;
        }

        const payloadStr = JSON.stringify({
          event: eventName,
          instanceId,
          data: payload,
          connection: {
            endpoint: endpoint,
            token: instanceObj?.token || ''
          }
        });

        fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadStr,
        }).then(async (response) => {
          let responseBody = null;
          try {
            responseBody = await response.json();
          } catch (e) {
            // Not JSON
          }
          await logWebhookEvent({
            instanceId,
            webhookId: webhook.id,
            event: eventName,
            targetUrl: webhook.url,
            requestPayload: { event: eventName, instanceId, data: payload },
            responseStatus: response.status,
            responseBody: responseBody,
            success: response.ok
          });
        }).catch(async (err) => {
          console.error(`Failed to dispatch webhook ${webhook.url}:`, err);
          await logWebhookEvent({
            instanceId,
            webhookId: webhook.id,
            event: eventName,
            targetUrl: webhook.url,
            requestPayload: { event: eventName, instanceId, data: payload },
            responseStatus: 500,
            responseBody: { error: err.message },
            success: false
          });
        });
      }
    }
  } catch (err) {
    console.error('Error fetching webhooks:', err);
  }
}
