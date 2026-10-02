import type { BlocoApi } from './types';

/**
 * CATÁLOGO DE BLOCOS. Cada bloco é independente e declara quem vê, o que pede
 * à API e se nasce ligado. As linhas dizem ONDE ele fica em cada visão.
 *
 * É daqui que sai o editor da Dashboard (esconder/mostrar/reordenar por
 * imobiliária), numa jornada futura: ele só vai mexer em `ligado` e na ordem.
 */
export type Visao = 'gestor' | 'corretor';

export type BlocoId =
  | 'imoveis' | 'numeros' | 'pendencias' | 'proximas_visitas' | 'roleta_agora' | 'minha_vez'
  | 'atendimento_time' | 'funil' | 'resultados'
  | 'leads_dia_semana' | 'leads_horario' | 'leads_seis_meses' | 'origem' | 'mapa_calor';

export interface BlocoCatalogo {
  id: BlocoId;
  titulo: string;
  visoes: Visao[];
  api: BlocoApi[];
  seguePeriodo: boolean;
  ligado: boolean;
}

const bloco = (b: BlocoCatalogo) => b;

export const CATALOGO: Record<BlocoId, BlocoCatalogo> = {
  imoveis:          bloco({ id: 'imoveis', titulo: 'Imóveis', visoes: ['gestor', 'corretor'], api: ['properties'], seguePeriodo: false, ligado: true }),
  numeros:          bloco({ id: 'numeros', titulo: 'Números do período', visoes: ['gestor', 'corretor'], api: ['kpis'], seguePeriodo: true, ligado: true }),
  pendencias:       bloco({ id: 'pendencias', titulo: 'Pendências', visoes: ['gestor', 'corretor'], api: ['pending'], seguePeriodo: false, ligado: true }),
  proximas_visitas: bloco({ id: 'proximas_visitas', titulo: 'Próximas visitas', visoes: ['gestor', 'corretor'], api: ['upcoming'], seguePeriodo: false, ligado: true }),
  roleta_agora:     bloco({ id: 'roleta_agora', titulo: 'Roleta agora', visoes: ['gestor'], api: [], seguePeriodo: false, ligado: true }),
  // A posição do corretor nas roletas em modo Fila. Busca o próprio dado e some sem roleta Fila.
  minha_vez:        bloco({ id: 'minha_vez', titulo: 'Sua vez na fila', visoes: ['corretor'], api: [], seguePeriodo: false, ligado: true }),
  atendimento_time: bloco({ id: 'atendimento_time', titulo: 'Atendimento do time', visoes: ['gestor'], api: ['team'], seguePeriodo: true, ligado: true }),
  funil:            bloco({ id: 'funil', titulo: 'Funil', visoes: ['gestor', 'corretor'], api: ['pipeline'], seguePeriodo: false, ligado: true }),
  resultados:       bloco({ id: 'resultados', titulo: 'Resultados', visoes: ['gestor'], api: ['results'], seguePeriodo: true, ligado: true }),
  leads_dia_semana: bloco({ id: 'leads_dia_semana', titulo: 'Leads por dia da semana', visoes: ['gestor', 'corretor'], api: ['leads_by_weekday'], seguePeriodo: true, ligado: true }),
  leads_horario:    bloco({ id: 'leads_horario', titulo: 'Leads por horário', visoes: ['gestor'], api: ['leads_by_hour'], seguePeriodo: true, ligado: true }),
  leads_seis_meses: bloco({ id: 'leads_seis_meses', titulo: 'Leads nos últimos 6 meses', visoes: ['gestor'], api: ['leads_6_months'], seguePeriodo: false, ligado: true }),
  origem:           bloco({ id: 'origem', titulo: 'De onde vêm os leads', visoes: ['gestor'], api: ['sources'], seguePeriodo: true, ligado: true }),
  // Pronto para o editor da Dashboard: existe, mas nasce desligado.
  mapa_calor:       bloco({ id: 'mapa_calor', titulo: 'Mapa de calor', visoes: ['gestor'], api: ['heatmap'], seguePeriodo: true, ligado: false }),
};

export interface Linha {
  titulo?: string;
  subtitulo?: string;
  /** A linha de cima do gestor: Imóveis estreito à esquerda, o resto largo à direita. */
  principal?: boolean;
  /** A segunda coluna é um cartão estreito, quase quadrado, à direita (Sua vez na fila). */
  lateral?: boolean;
  colunas: BlocoId[][];
}

export const LINHAS: Record<Visao, Linha[]> = {
  gestor: [
    { principal: true, colunas: [['imoveis'], ['numeros', 'pendencias']] },
    { colunas: [['proximas_visitas'], ['roleta_agora']] },
    { colunas: [['atendimento_time'], ['funil']] },
    { colunas: [['resultados']] },
    {
      titulo: 'Análise do período',
      subtitulo: 'De onde e quando os leads chegam',
      colunas: [['leads_dia_semana'], ['leads_horario']],
    },
    { colunas: [['leads_seis_meses'], ['origem']] },
    { colunas: [['mapa_calor']] },
  ],
  corretor: [
    // Sem roleta Fila o cartão não desenha nada, a coluna some (`.lmfn-coluna:empty`)
    // e as Pendências ocupam a linha inteira, como antes.
    { lateral: true, colunas: [['pendencias'], ['minha_vez']] },
    { colunas: [['numeros']] },
    { colunas: [['proximas_visitas'], ['funil']] },
    { colunas: [['imoveis'], ['leads_dia_semana']] },
  ],
};

export function linhasDaVisao(visao: Visao): Linha[] {
  return LINHAS[visao]
    .map(linha => ({
      ...linha,
      colunas: linha.colunas
        .map(col => col.filter(id => CATALOGO[id].ligado && CATALOGO[id].visoes.includes(visao)))
        .filter(col => col.length > 0),
    }))
    .filter(linha => linha.colunas.length > 0);
}

/**
 * Blocos com pedido próprio: o Funil muda pelo seletor dele, e trocar de funil
 * não pode refazer o resto da tela (pendências, time, resultados…).
 */
const PEDIDO_A_PARTE: BlocoId[] = ['funil'];

/** O pedido principal, para as duas visões: o servidor tira sozinho o que o corretor não vê. */
export const BLOCOS_API: BlocoApi[] = Array.from(
  new Set(
    (['gestor', 'corretor'] as Visao[])
      .flatMap(v => linhasDaVisao(v))
      .flatMap(l => l.colunas.flat())
      .filter(id => !PEDIDO_A_PARTE.includes(id))
      .flatMap(id => CATALOGO[id].api),
  ),
);

/** O pedido do Funil, com o `pipeline_id` escolhido nele. */
export const BLOCOS_FUNIL: BlocoApi[] = CATALOGO.funil.api;
