// Situação do "Site da imobiliária" no selo da casa (mesmo jeito de features/portals/situacao.ts).
import { plural, tempoDesde } from '@/lib/formato';
import type { FonteDoSite } from '@/services/properties/siteFeedService';

export interface SituacaoDoSite {
  chave: 'nao_configurado' | 'off' | 'waiting' | 'ok' | 'problem' | 'stopped';
  rotulo: string;
  selo: 'inactive' | 'warning' | 'success' | 'error';
  detalhe: string;
}

const imoveis = (n?: number | null) => (n == null ? '' : plural(n, 'imóvel', 'imóveis'));

export function situacaoDoSite(f: FonteDoSite, agora: Date = new Date()): SituacaoDoSite {
  if (!f.configured) return { chave: 'nao_configurado', rotulo: 'Não configurado', selo: 'inactive', detalhe: '' };
  if (f.state === 'off') {
    return { chave: 'off', rotulo: 'Desligado', selo: 'inactive', detalhe: 'Os imóveis ficam como estão e podem ser editados.' };
  }
  if (f.state === 'stopped') {
    // Spec: mostra o motivo e há quanto tempo (desde a última leitura boa, quando houver).
    const boa = f.last_success_at ? `última leitura boa ${tempoDesde(f.last_success_at, agora)}` : '';
    return { chave: 'stopped', rotulo: 'Parou de ler', selo: 'error',
      detalhe: [`Motivo: ${f.last_error ?? 'o site não respondeu'}`, boa].filter(Boolean).join(' · ') };
  }
  if (f.state === 'problem') {
    return { chave: 'problem', rotulo: 'Arquivo com problema', selo: 'warning',
      detalhe: `${f.last_error ?? 'O arquivo veio diferente do normal.'} Nenhum imóvel foi inativado. Assim que o arquivo voltar ao normal, a leitura segue sozinha.` };
  }
  if (f.state === 'waiting') {
    return { chave: 'waiting', rotulo: 'Lendo pela primeira vez', selo: 'warning', detalhe: 'Pode levar alguns minutos.' };
  }
  const quando = f.last_checked_at ? `Última leitura ${tempoDesde(f.last_checked_at, agora)}` : '';
  return { chave: 'ok', rotulo: 'Lendo', selo: 'success', detalhe: [quando, imoveis(f.last_count)].filter(Boolean).join(' · ') };
}

export function resumoDaMudanca(s?: Record<string, unknown>): string | null {
  if (!s) return null;
  const n = (k: string) => Number(s[k] ?? 0) || 0;
  const partes = [
    n('create') && plural(n('create'), 'novo', 'novos'),
    n('update') && plural(n('update'), 'atualizado', 'atualizados'),
    n('inactivate') && plural(n('inactivate'), 'saiu', 'saíram'),
    n('reactivate') && plural(n('reactivate'), 'voltou', 'voltaram'),
  ].filter(Boolean) as string[];
  return partes.length ? partes.join(' · ') : null;
}

export function estadoNoCartao(f: FonteDoSite): string {
  const s = situacaoDoSite(f);
  return s.chave === 'ok' && f.last_count != null ? `Lendo · ${imoveis(f.last_count)}` : s.rotulo;
}
