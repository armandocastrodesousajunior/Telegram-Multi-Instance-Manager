export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // We only want to reconnect Telegram instances in the Node.js runtime,
    // not in the Edge runtime.
    const { telegramManager } = await import('./lib/telegram/client');
    
    try {
      // Reconnect all previously connected instances on startup
      await telegramManager.reconnectAll();
    } catch (err) {
      console.error('[Instrumentation] Error during reconnectAll:', err);
    }
  }
}
