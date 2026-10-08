// Funções puras de leitura do PipelineItem, compartilhadas entre PipelineKanban.tsx
// (filtros/busca/coluna/lista) e PipelineItemCard.tsx (card memoizado do board).
//
// Ficam FORA de qualquer componente de propósito: como não fecham sobre estado/props
// reativos (só recebem os argumentos explícitos), a referência da função nunca muda
// entre renders — mais forte que useCallback (sem array de dependências pra errar) e
// suficiente pra não quebrar a memoização do card extraído.
//
// A exceção (resolveItemName precisa de `t`) recebe esse dado como argumento explícito, continuando pura.

import { PipelineItem } from '@/types/analytics';
import { isPhoneLikeName } from '@/lib/nomeDoContato';

// Nome cru às vezes vem como o número de telefone (Evolution não manda pushName no 1º evento).
// Resolve pro melhor candidato disponível, descartando nomes que são só dígitos/telefone.
// A régua mora em @/lib/nomeDoContato (a mesma do card aberto e da oferta em Conversas).
export { isPhoneLikeName };

export const resolveItemName = (
  item: PipelineItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  const candidates = [item.contact?.name, item.conversation?.contact?.name];
  const good = candidates.find(c => c && !isPhoneLikeName(c));
  if (good) return good as string;
  // sem nome real: mostra o telefone formatado em vez de string crua tipo JID
  const phone =
    item.contact?.phone_number || item.conversation?.contact?.phone_number || candidates[0];
  return phone || t('kanban.conversation.unknownUser');
};

// Data de chegada do lead no pipeline (quando o card entrou).
export const formatArrivalDate = (item: PipelineItem): string | null => {
  const raw = item.entered_at
    ? item.entered_at * 1000
    : item.created_at
    ? typeof item.created_at === 'number'
      ? item.created_at * 1000
      : new Date(item.created_at).getTime()
    : null;
  if (!raw) return null;
  return new Date(raw).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
};

// Chegada do lead em epoch ms — pra ordenar a Lista por ordem de chegada real
// (não confundir com `position`, a ordem manual de arraste dentro da coluna).
export const itemArrivalMs = (item: PipelineItem): number => {
  if (typeof item.entered_at === 'number') return item.entered_at * 1000;
  if (typeof item.created_at === 'number') return item.created_at * 1000;
  return item.created_at ? new Date(item.created_at).getTime() : 0;
};

// Último contato com o lead medido pela CONVERSA da instância WhatsApp.
// last_non_activity_message = última mensagem real (entrada OU saída), incluindo
// mensagens que o corretor mandou pelo celular (persistidas via webhook Evolution).
// NÃO é baseado em envios internos do LM Flow — é o timestamp da própria conversa.
export const lastContactMs = (item: PipelineItem): number | null => {
  const msg = item.conversation?.last_non_activity_message;
  if (msg?.created_at != null) {
    return typeof msg.created_at === 'number'
      ? msg.created_at * 1000
      : new Date(msg.created_at).getTime();
  }
  if (item.conversation?.last_activity_at) {
    return item.conversation.last_activity_at * 1000;
  }
  return null;
};

// Labels da conversa (vêm como string[] ou {title}[]).
export const itemLabels = (item: PipelineItem): string[] => {
  const raw = (item.conversation as any)?.labels ?? [];
  return Array.isArray(raw)
    ? raw.map((l: any) => (typeof l === 'string' ? l : l?.title ?? '')).filter(Boolean)
    : [];
};

// Tags do lead pro filtro: une as etiquetas do contato (as que aparecem no card,
// ex "tráfego pago") com as labels da conversa. Retorna {name,color} sem repetir.
export const itemTagInfos = (item: PipelineItem): Array<{ name: string; color: string }> => {
  const out: Array<{ name: string; color: string }> = [];
  const seen = new Set<string>();
  const push = (name?: string | null, color?: string | null) => {
    const n = (name || '').trim();
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push({ name: n, color: color || '#7c3aed' });
  };
  const contactLabels = (item.contact as any)?.labels;
  if (Array.isArray(contactLabels)) {
    contactLabels.forEach((l: any) => push(l?.name || l?.title, l?.color));
  }
  itemLabels(item).forEach(n => push(n));
  return out;
};

export const itemTagNames = (item: PipelineItem): string[] =>
  itemTagInfos(item).map(t => t.name);

export const getContactColor = (name?: string): string => {
  if (!name) return '#6B7280';
  const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#F97316'];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

// Valor de ordenação do card: position quando existe, senão a chegada
// (entered_at/created_at em epoch). Mesma escala em ambos (segundos).
export const itemPos = (it: PipelineItem): number =>
  typeof it.position === 'number'
    ? it.position
    : typeof it.entered_at === 'number'
    ? it.entered_at
    : new Date(it.created_at).getTime() / 1000;

// Calculate stage total value
export const calculateStageTotal = (items: PipelineItem[] = []): number => {
  return items.reduce((total, item) => total + (item.value || 0), 0);
};
