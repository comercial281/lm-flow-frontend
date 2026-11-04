import { diff, fimContrato, proximoAniversario } from './motor';
import type { Contrato, Severidade } from './tipos';

export interface ChipDoContrato {
  rotulo: string;
  sev: Severidade;
}

export interface SituacaoDoContrato {
  chips: ChipDoContrato[];
  /** Algum chip pede ação (vermelho ou amarelo): é o filtro "Precisam de atenção". */
  atencao: boolean;
}

/** Os selos de uma linha de contrato. `hoje` = "AAAA-MM-DD" (hojeEmSaoPaulo()). */
export function situacaoDoContrato(c: Contrato, hoje: string): SituacaoDoContrato {
  if (c.status === 'encerrado') return { chips: [{ rotulo: 'Encerrado', sev: 'info' }], atencao: false };
  const chips: ChipDoContrato[] = [];
  if ((c.em_atraso_qtd ?? 0) > 0) chips.push({ rotulo: 'Aluguel atrasado', sev: 'bad' });

  const aniversario = proximoAniversario(c.ultimo_reajuste, c.inicio);
  const paraReajuste = diff(hoje, aniversario);
  if (paraReajuste < 0) chips.push({ rotulo: 'Reajuste atrasado', sev: 'bad' });
  else if (paraReajuste <= 45) chips.push({ rotulo: `Reajuste em ${paraReajuste} ${paraReajuste === 1 ? 'dia' : 'dias'}`, sev: 'warn' });

  const paraOFim = diff(hoje, fimContrato(c.inicio, c.meses));
  if (paraOFim < 0) chips.push({ rotulo: 'Prazo indeterminado', sev: 'info' });
  else if (paraOFim <= 90) chips.push({ rotulo: `Termina em ${paraOFim} ${paraOFim === 1 ? 'dia' : 'dias'}`, sev: 'warn' });

  if (!c.chaves?.entrega?.assinado) chips.push({ rotulo: 'Chaves não registradas', sev: 'warn' });

  if (!chips.length) chips.push({ rotulo: 'Em dia', sev: 'ok' });
  return { chips, atencao: chips.some((x) => x.sev === 'bad' || x.sev === 'warn') };
}

export type FiltroDeContratos = 'todos' | 'atencao' | 'em_dia' | 'encerrados';

export function passaNoFiltro(c: Contrato, filtro: FiltroDeContratos, hoje: string): boolean {
  if (filtro === 'todos') return true;
  if (filtro === 'encerrados') return c.status === 'encerrado';
  if (c.status === 'encerrado') return false;
  const { atencao } = situacaoDoContrato(c, hoje);
  return filtro === 'atencao' ? atencao : !atencao;
}

export interface ProximaAcao {
  titulo: string;
  texto: string;
  rotulo: string;
  /** Aba da ficha para onde o botão leva. */
  aba: 'resumo' | 'cobrancas' | 'reajuste' | 'chaves' | 'encerramento';
  sev: Severidade;
}

/** A faixa de cima da ficha: a próxima coisa a fazer neste contrato, na ordem de urgência. */
export function proximaAcao(
  c: Contrato,
  hoje: string,
  extra: { diasDeAtraso?: number; valorEmAtraso?: string; proximoBoleto?: { valor: string; vencimento: string } | null; indiceTexto?: string; dataEncerrado?: string } = {},
): ProximaAcao {
  const nome = (c.inquilino_nome || '').split(' ')[0];
  if (c.status === 'encerrado') {
    return { titulo: `Contrato encerrado${extra.dataEncerrado ? ` em ${extra.dataEncerrado}` : ''}`, texto: 'O termo de rescisão e o acerto final foram gerados.', rotulo: 'Ver acerto', aba: 'encerramento', sev: 'info' };
  }
  if ((c.em_atraso_qtd ?? 0) > 0) {
    const d = extra.diasDeAtraso ?? 0;
    return { titulo: `Aluguel atrasado há ${d} ${d === 1 ? 'dia' : 'dias'}`, texto: `Hoje ${nome} deve ${extra.valorEmAtraso ?? ''}. A régua já mandou os lembretes.`.replace('deve .', 'deve.'), rotulo: 'Ver boleto', aba: 'cobrancas', sev: 'bad' };
  }
  if (!c.chaves?.entrega?.assinado) {
    return { titulo: 'Falta registrar a entrega das chaves', texto: 'Registre o termo de entrega e faça o laudo de vistoria de entrada.', rotulo: 'Registrar', aba: 'chaves', sev: 'warn' };
  }
  if (!c.vistoria?.entrada?.concluida) {
    return { titulo: 'Falta concluir o laudo de vistoria de entrada', texto: 'É com ele que a saída vai ser comparada.', rotulo: 'Fazer vistoria', aba: 'chaves', sev: 'warn' };
  }
  const aniversario = proximoAniversario(c.ultimo_reajuste, c.inicio);
  const paraReajuste = diff(hoje, aniversario);
  if (paraReajuste <= 45) {
    return {
      titulo: paraReajuste < 0 ? `Reajuste atrasado há ${-paraReajuste} dias` : `Reajuste em ${paraReajuste} dias`,
      texto: `${extra.indiceTexto ?? c.indice} acumulado de 12 meses, a partir de ${aniversario.split('-').reverse().join('/')}.`,
      rotulo: 'Ver reajuste',
      aba: 'reajuste',
      sev: paraReajuste < 0 ? 'bad' : 'warn',
    };
  }
  const paraOFim = diff(hoje, fimContrato(c.inicio, c.meses));
  if (paraOFim <= 90) {
    return {
      titulo: paraOFim < 0 ? 'Prazo terminou: segue por tempo indeterminado' : `Contrato termina em ${paraOFim} dias`,
      texto: 'Renovar, renegociar ou preparar a saída.',
      rotulo: 'Ver encerramento',
      aba: 'encerramento',
      sev: 'info',
    };
  }
  if (extra.proximoBoleto) {
    return { titulo: `Próximo boleto: ${extra.proximoBoleto.valor}, vence em ${extra.proximoBoleto.vencimento}`, texto: 'Nada atrasado neste contrato.', rotulo: 'Ver boleto', aba: 'cobrancas', sev: 'info' };
  }
  return { titulo: 'Tudo em dia', texto: 'Nada pendente neste contrato.', rotulo: 'Ver resumo', aba: 'resumo', sev: 'ok' };
}
