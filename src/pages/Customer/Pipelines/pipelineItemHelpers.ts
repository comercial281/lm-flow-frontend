// Funções puras de leitura do PipelineItem, compartilhadas entre PipelineKanban.tsx
// (filtros/busca/coluna/lista) e PipelineItemCard.tsx (card memoizado do board).
//
// Ficam FORA de qualquer componente de propósito: como não fecham sobre estado/props
// reativos (só recebem os argumentos explícitos), a referência da função nunca muda
// entre renders — mais forte que useCallback (sem array de dependências pra errar) e
// suficiente pra não quebrar a memoização do card extraído.
//
// As duas exceções (resolveItemName precisa de `t`, itemVisitLabel precisa do mapa
// visitsByContact) recebem esses dados como argumento explícito, continuando puras.

import { PipelineItem } from '@/types/analytics';

// Nome cru às vezes vem como o número de telefone (Evolution não manda pushName no 1º evento).
// Resolve pro melhor candidato disponível, descartando nomes que são só dígitos/telefone.
export const isPhoneLikeName = (value?: string | null): boolean => {
  if (!value) return true;
  return /^[+\d\s()\-@.]+$/.test(value.replace(/whatsapp|net|us|s\./gi, ''));
};

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

export const resolveItemAvatar = (item: PipelineItem): string | undefined => {
  return item.contact?.avatar_url || item.conversation?.contact?.avatar_url || undefined;
};

// ID único do lead pro card. Usa o id do contato (a pessoa), não o número da
// conversa: lead importado sem WhatsApp não tem conversa, então display_id caía
// tudo no mesmo número. Contato é único por lead e estável.
export const resolveItemRef = (item: PipelineItem): string => {
  const id = item.contact?.id || item.conversation?.contact?.id || item.item_id || item.id;
  return String(id).padStart(4, '0');
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

export const lastContactDays = (item: PipelineItem): number | null => {
  const ms = lastContactMs(item);
  if (!ms) return null;
  return Math.floor((Date.now() - ms) / 86_400_000);
};

// Labels da conversa (vêm como string[] ou {title}[]).
export const itemLabels = (item: PipelineItem): string[] => {
  const raw = (item.conversation as any)?.labels ?? [];
  return Array.isArray(raw)
    ? raw.map((l: any) => (typeof l === 'string' ? l : l?.title ?? '')).filter(Boolean)
    : [];
};

export const hasVisitScheduled = (item: PipelineItem): boolean =>
  itemLabels(item).includes('visita-agendada');

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

// Dia/hora da próxima visita do lead (do mapa carregado de /visits).
export const itemVisitLabel = (
  item: PipelineItem,
  visitsByContact: Record<string, string>,
): string | null => {
  const cid = item.contact?.id || item.conversation?.contact?.id;
  const when = cid ? visitsByContact[cid] : undefined;
  if (!when) return null;
  return new Date(when).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

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
