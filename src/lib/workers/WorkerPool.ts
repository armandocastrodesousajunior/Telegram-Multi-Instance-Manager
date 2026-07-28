import { Worker } from 'worker_threads';
import { randomUUID } from 'crypto';
import os from 'os';

// ── Worker Script (embutido como string para máxima compatibilidade: dev, Docker, produção) ──
// O script roda em sua própria thread com Event Loop totalmente isolado.
// Isso elimina o Timer Drift causado pelo Event Loop lotado do Node.js principal.
const WORKER_SCRIPT = `
const { parentPort } = require('worker_threads');

const activeJobs = new Map();

parentPort.on('message', async (job) => {
  if (job.type === 'CANCEL') {
    const j = activeJobs.get(job.jobId);
    if (j) j.cancelled = true;
    return;
  }

  const { jobId, duration, intervalMs = 4000 } = job;
  const state = { cancelled: false };
  activeJobs.set(jobId, state);

  const startTime = Date.now();
  const targetEndTime = startTime + duration;

  // Sinal inicial para o thread principal disparar o SetTyping imediatamente
  parentPort.postMessage({ type: 'SEND_SIGNAL', jobId });

  while (Date.now() < targetEndTime && !state.cancelled) {
    const remaining = targetEndTime - Date.now();
    if (remaining <= 0) break;

    // Sleep preciso no Event Loop isolado deste worker (sem interferência do GramJS!)
    const sleepTime = Math.min(intervalMs, remaining);
    await new Promise(r => setTimeout(r, sleepTime));

    if (state.cancelled) break;

    // Se ainda há tempo, sinaliza para renovar o "digitando..."
    if (Date.now() < targetEndTime) {
      parentPort.postMessage({ type: 'SEND_SIGNAL', jobId });
    }
  }

  activeJobs.delete(jobId);
  parentPort.postMessage({ type: 'DONE', jobId, simulationMs: Date.now() - startTime });
});
`;

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type JobType = 'SIMULATE_TYPING' | 'SIMULATE_FILE_ACTION';

interface WorkerMessage {
  type: 'SEND_SIGNAL' | 'DONE' | 'ERROR';
  jobId: string;
  simulationMs?: number;
  error?: string;
}

interface PendingJob {
  resolve: (result: { simulationMs: number }) => void;
  reject: (err: Error) => void;
  onSignal: () => void;
  timeoutHandle: NodeJS.Timeout;
}

// ── WorkerPool ────────────────────────────────────────────────────────────────

/**
 * Pool genérico de Worker Threads para operações de timer/CPU-bound.
 *
 * Cada worker roda com seu próprio Event Loop isolado, eliminando o Timer Drift
 * causado pela sobrecarga do Event Loop principal sob alta concorrência.
 *
 * Configurável via variáveis de ambiente:
 *   WORKER_POOL_SIZE        — número de threads (padrão: cpus - 2, mín 1)
 *   WORKER_JOB_TIMEOUT_MS   — timeout máximo de qualquer job em ms (padrão: 30000)
 *   SIMULATION_MAX_MS       — teto de simulação de digitação/mídia em ms (padrão: 15000)
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private pendingJobs = new Map<string, PendingJob>();
  private roundRobinIndex = 0;
  private initialized = false;

  readonly poolSize: number;
  readonly jobTimeoutMs: number;
  readonly simulationMaxMs: number;

  constructor() {
    const defaultPoolSize = Math.max(1, os.cpus().length - 2);
    this.poolSize        = parseInt(process.env.WORKER_POOL_SIZE      || '') || defaultPoolSize;
    this.jobTimeoutMs    = parseInt(process.env.WORKER_JOB_TIMEOUT_MS || '') || 30000;
    this.simulationMaxMs = parseInt(process.env.SIMULATION_MAX_MS     || '') || 15000;
  }

  // ── Inicialização lazy (evita criar threads antes do primeiro uso) ─────────
  private ensureInitialized(): void {
    if (this.initialized) return;
    this.initialized = true;

    for (let i = 0; i < this.poolSize; i++) {
      this.spawnWorker(i);
    }

    console.log(
      `[WorkerPool] ✅ ${this.poolSize} worker threads inicializados` +
      ` | jobTimeout=${this.jobTimeoutMs}ms | simulationMax=${this.simulationMaxMs}ms`
    );
  }

  private spawnWorker(index: number): void {
    const worker = new Worker(WORKER_SCRIPT, { eval: true });

    worker.on('message', (msg: WorkerMessage) => this.onWorkerMessage(msg));

    worker.on('error', (err) => {
      console.error(`[WorkerPool] Worker #${index} erro:`, err.message);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.warn(`[WorkerPool] Worker #${index} encerrou com código ${code}. Reiniciando...`);
        this.spawnWorker(index); // Auto-restart
        this.workers[index] = this.workers[this.workers.length - 1];
        this.workers.pop();
      }
    });

    if (this.workers[index]) {
      this.workers[index] = worker;
    } else {
      this.workers.push(worker);
    }
  }

  // ── Handler de mensagens dos workers (sempre roda no main thread via event loop) ──
  private onWorkerMessage(msg: WorkerMessage): void {
    const job = this.pendingJobs.get(msg.jobId);
    if (!job) return;

    if (msg.type === 'SEND_SIGNAL') {
      // Executa o callback fire-and-forget no main thread (ex: client.invoke SetTyping)
      try { job.onSignal(); } catch (_) {}

    } else if (msg.type === 'DONE') {
      clearTimeout(job.timeoutHandle);
      this.pendingJobs.delete(msg.jobId);
      job.resolve({ simulationMs: msg.simulationMs ?? 0 });

    } else if (msg.type === 'ERROR') {
      clearTimeout(job.timeoutHandle);
      this.pendingJobs.delete(msg.jobId);
      // Resolve graciosamente — nunca quebra o fluxo de envio de mensagem
      job.resolve({ simulationMs: 0 });
    }
  }

  // ── API Pública ────────────────────────────────────────────────────────────

  /**
   * Executa uma simulação de timer no Worker Thread Pool.
   *
   * @param duration    Duração desejada em ms (já deve ter o teto `simulationMaxMs` aplicado)
   * @param onSignal    Callback chamado no main thread a cada ~intervalMs
   *                    (use para disparar client.invoke(SetTyping) em fire-and-forget)
   * @param intervalMs  Intervalo entre sinais ao Telegram (padrão: 4000ms)
   * @returns           { simulationMs } — tempo real gasto na simulação
   */
  async runSimulation(
    duration: number,
    onSignal: () => void,
    intervalMs: number = 4000
  ): Promise<{ simulationMs: number }> {
    this.ensureInitialized();

    if (duration <= 0) return { simulationMs: 0 };

    return new Promise((resolve) => {
      const jobId = randomUUID();

      // Fallback de segurança: se o worker travar, resolve após timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingJobs.delete(jobId);
        console.warn(`[WorkerPool] Job ${jobId} atingiu timeout de ${this.jobTimeoutMs}ms. Resolvendo graciosamente.`);
        resolve({ simulationMs: duration });
      }, this.jobTimeoutMs);

      this.pendingJobs.set(jobId, {
        resolve,
        reject: () => {},
        onSignal,
        timeoutHandle
      });

      // Distribuição round-robin entre os workers disponíveis
      const workerIndex = this.roundRobinIndex % this.workers.length;
      this.roundRobinIndex++;

      this.workers[workerIndex].postMessage({ jobId, duration, intervalMs });
    });
  }

  /** Cancela um job em andamento (best-effort) */
  cancelJob(jobId: string): void {
    const job = this.pendingJobs.get(jobId);
    if (!job) return;
    const workerIndex = this.roundRobinIndex % this.workers.length;
    this.workers[workerIndex].postMessage({ type: 'CANCEL', jobId });
    clearTimeout(job.timeoutHandle);
    this.pendingJobs.delete(jobId);
    job.resolve({ simulationMs: 0 });
  }

  /** Encerra todos os workers graciosamente */
  async shutdown(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
    this.initialized = false;
    console.log('[WorkerPool] 🛑 Shutdown completo.');
  }

  /** Retorna métricas do pool para observabilidade */
  getStats() {
    return {
      poolSize: this.poolSize,
      activeJobs: this.pendingJobs.size,
      simulationMaxMs: this.simulationMaxMs,
      jobTimeoutMs: this.jobTimeoutMs,
    };
  }
}

// ── Singleton global ──────────────────────────────────────────────────────────
// Persiste entre hot-reloads do Next.js em desenvolvimento (mesmo padrão do Prisma)
const globalWithPool = globalThis as typeof globalThis & { _workerPool?: WorkerPool };

export function getWorkerPool(): WorkerPool {
  if (!globalWithPool._workerPool) {
    globalWithPool._workerPool = new WorkerPool();
  }
  return globalWithPool._workerPool;
}
