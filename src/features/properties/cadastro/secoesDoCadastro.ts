// Quais seções a página de cadastro mostra, por tipo (Fase 4, Imóveis, entrega 3).
// A regra mora aqui e só aqui: índice, página e testes leem desta lista.
import type { ListingKind } from '../listingKind';

export type SecaoId = 'basico' | 'construtora' | 'proprietario' | 'localizacao' | 'obra' | 'tipologias' | 'valores'
  | 'composicao' | 'detalhesVenda' | 'caracteristicas' | 'midia' | 'descricao' | 'equipe' | 'comissao'
  | 'dadosInternos' | 'ondeDivulgar';

export interface Secao { id: SecaoId; titulo: string }

const TITULO: Record<SecaoId, string> = {
  basico: 'Básico', construtora: 'Construtora', proprietario: 'Proprietário', localizacao: 'Localização',
  obra: 'Obra', tipologias: 'Tipologias e valores', valores: 'Valores', composicao: 'Composição',
  detalhesVenda: 'Detalhes da venda', caracteristicas: 'Características', midia: 'Fotos e vídeos',
  descricao: 'Descrição', equipe: 'Equipe', comissao: 'Comissão', dadosInternos: 'Dados internos',
  ondeDivulgar: 'Onde divulgar',
};

const ORDEM: Record<ListingKind, SecaoId[]> = {
  development: ['basico', 'construtora', 'localizacao', 'obra', 'tipologias', 'detalhesVenda', 'caracteristicas',
    'midia', 'descricao', 'equipe', 'comissao'],
  resale: ['basico', 'proprietario', 'localizacao', 'valores', 'composicao', 'detalhesVenda', 'caracteristicas',
    'midia', 'descricao', 'equipe', 'comissao', 'dadosInternos'],
  // Leilão = seções da revenda; a ocupação e a avaliação moram em Valores.
  auction: ['basico', 'proprietario', 'localizacao', 'valores', 'composicao', 'detalhesVenda', 'caracteristicas',
    'midia', 'descricao', 'equipe', 'comissao', 'dadosInternos'],
};

export function secoesDoCadastro(kind: ListingKind, { editando }: { editando: boolean }): Secao[] {
  const ids = editando ? [...ORDEM[kind], 'ondeDivulgar' as const] : ORDEM[kind];
  return ids.map(id => ({ id, titulo: TITULO[id] }));
}

export function tipoDaUrl(valor: string | null): ListingKind | null {
  // Aceita o singular (link antigo) e o plural da aba (ABA_NA_URL).
  if (valor === 'empreendimento' || valor === 'empreendimentos') return 'development';
  if (valor === 'revenda') return 'resale';
  if (valor === 'leilao') return 'auction';
  return null;
}
