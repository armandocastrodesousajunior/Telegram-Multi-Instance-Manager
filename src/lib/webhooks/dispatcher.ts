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

    for (const webhook of webhooks) {
      let events: string[] = [];
      try {
        events = JSON.parse(webhook.events);
      } catch (e) {
        continue;
      }
      
      if (events.includes(eventName) || events.includes('*')) {
        const payloadStr = JSON.stringify({
          event: eventName,
          instanceId,
          data: payload,
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
