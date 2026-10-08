// CSV do funil. Desde a situação do card (07/10/2026) leva a situação e o motivo
// da perda; a Parte 4 acrescenta preço estimado e data de fechamento esperada.
import { contatoDoCard } from '@/features/cardDoLead/cardDoLead';
import { NOME_DA_SITUACAO, situacaoDe } from '@/features/pipelines/situacao/situacao';
import { formatDateBR } from '@/utils/dateUtils';
import type { PipelineStage } from '@/types/analytics';

const CABECALHO = ['nome', 'email', 'telefone', 'etapa', 'situacao', 'motivo_da_perda', 'valor', 'entrada'] as const;
type Linha = Record<(typeof CABECALHO)[number], string>;

const celula = (valor: string) => `"${valor.replace(/"/g, '""')}"`;

export function csvDoFunil(stages: PipelineStage[]): { csv: string; linhas: number } {
  const linhas: Linha[] = stages.flatMap(stage =>
    (stage.items || []).map(item => {
      const contato = contatoDoCard(item);
      const situacao = situacaoDe(item);
      return {
        nome: contato?.name || '',
        email: contato?.email || '',
        telefone: contato?.phone_number || '',
        etapa: stage.name,
        situacao: NOME_DA_SITUACAO[situacao],
        motivo_da_perda: situacao === 'lost' ? item.lost_reason?.label ?? '' : '',
        valor: item.value != null ? String(item.value) : '',
        entrada: item.entered_at ? formatDateBR(item.entered_at * 1000) : formatDateBR(item.created_at),
      };
    }),
  );
  const csv = [CABECALHO.join(','), ...linhas.map(l => CABECALHO.map(c => celula(l[c])).join(','))].join('\n');
  return { csv, linhas: linhas.length };
}
