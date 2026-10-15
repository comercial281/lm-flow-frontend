import { pipelinesService } from '@/services/pipelines';
import type { Pipeline } from '@/types/analytics';

// Último payload de cada pipeline. Reabrir um pipe pinta o board NA HORA com o
// dado anterior enquanto a versão fresca chega por trás (stale-while-revalidate).
// Persistido em sessionStorage pra sobreviver ao F5; cap de entradas pra não
// estourar a cota (~5MB) com boards grandes.

const STORAGE_KEY = 'lmflow:pipeline-payloads:v2';
const MAX_ENTRIES = 5;
const PREFETCH_TTL = 60_000; // hover repetido no mesmo card não re-busca por 60s

type Entry = { data: Pipeline; at: number };

function loadFromSession(): Map<string, Entry> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw) as Record<string, Entry>));
  } catch {
    return new Map();
  }
}

const entries = loadFromSession();

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // cota estourada: derruba tudo e segue só em memória
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }
}

export function getCachedPipeline(pipelineId: string): Pipeline | undefined {
  return entries.get(pipelineId)?.data;
}

export function setCachedPipeline(pipelineId: string, data: Pipeline) {
  entries.delete(pipelineId); // re-inserir mantém ordem LRU
  entries.set(pipelineId, { data, at: Date.now() });
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
  persist();
}

// Aba Abertos de um funil, com dedupe em voo: o hover (prefetch) e o quadro
// que abre logo depois dividem o MESMO pedido. Antes eram dois GET pesados ao
// mesmo tempo (um sem status, outro com status=open), o servidor montava o
// funil inteiro duas vezes.
// reaproveitar=false (recarga depois de uma ação, poll, tempo real) SEMPRE pede
// de novo: juntar-se a um pedido que começou antes da ação traria o quadro de
// antes dela (o card movido voltava pra coluna antiga).
const inflight = new Map<string, Promise<Pipeline>>();

export function loadOpenPipeline(pipelineId: string, { reaproveitar = true } = {}): Promise<Pipeline> {
  const emVoo = inflight.get(pipelineId);
  if (emVoo && reaproveitar) return emVoo;

  const p: Promise<Pipeline> = pipelinesService
    .getPipeline(pipelineId, { status: 'open' })
    .then(data => {
      // Resposta de um pedido que já foi substituído por um mais novo não
      // regrava o cache por cima do mais novo.
      if (inflight.get(pipelineId) === p) setCachedPipeline(pipelineId, data);
      return data;
    })
    .finally(() => {
      if (inflight.get(pipelineId) === p) inflight.delete(pipelineId);
    });
  inflight.set(pipelineId, p);
  return p;
}

// Prefetch no hover: passou o mouse no card, o payload já começa a descer.
// TTL pra não virar rajada de requests.
export function prefetchPipeline(pipelineId: string): void {
  if (!pipelineId) return;
  const cached = entries.get(pipelineId);
  if (cached && Date.now() - cached.at < PREFETCH_TTL) return;

  loadOpenPipeline(pipelineId).catch(() => {
    /* prefetch é oportunista: se o clique se juntou a ele, o quadro mostra o
       erro com "Tentar de novo" */
  });
}
