import type { DestinoDoDinheiro, Intermediacao, TipoGarantia } from './tipos';

export const GARANTIA: Record<TipoGarantia, string> = {
  caucao: 'Caução',
  fianca: 'Fiador',
  seguro: 'Seguro-fiança',
  titulo: 'Título de capitalização',
  outra: 'Outra garantia',
  nenhuma: 'Sem garantia',
};

export const INTERMEDIACAO: Record<Intermediacao, string> = {
  nao: 'Não cobra',
  cheio: '1º aluguel cheio',
  proporcional: 'Valor do 1º boleto (proporcional aos dias)',
};

/** Para onde vai cada real do boleto: rótulo, explicação curta e a cor do ponto. */
export const DESTINO: Record<DestinoDoDinheiro, { rotulo: string; ajuda: string; cor: string }> = {
  prop: { rotulo: 'Proprietário', ajuda: 'aluguel, vai para o repasse', cor: 'bg-primary' },
  terc: { rotulo: 'Contas', ajuda: 'condomínio, IPTU e seguros: a imobiliária recebe e paga', cor: 'bg-amber-500' },
  caucao: { rotulo: 'Caução', ajuda: 'fica guardada até o fim do contrato', cor: 'bg-sky-500' },
  imob: { rotulo: 'Imobiliária', ajuda: 'taxas que ficam com você', cor: 'bg-emerald-500' },
};

export const ORDEM_DOS_DESTINOS: DestinoDoDinheiro[] = ['prop', 'terc', 'caucao', 'imob'];

export const ESTADOS_DE_VISTORIA = ['Novo', 'Bom', 'Regular', 'Ruim', 'Faltando'] as const;

/** Nota de cada estado: a saída pior que a entrada pede decisão (desgaste normal ou dano). */
export const NOTA_DO_ESTADO: Record<string, number> = { Novo: 4, Bom: 3, Regular: 2, Ruim: 1, Faltando: 0 };

export const LEMBRETES_DA_REGUA = [
  { quando: '3 dias antes', texto: 'lembrete com o valor e o link.' },
  { quando: '1 dia depois', texto: '2ª via já com multa e juros.' },
  { quando: '5 dias depois', texto: 'pergunta se precisa de ajuda.' },
  { quando: '15 dias depois', texto: 'aviso formal ao inquilino, e a equipe é avisada para acionar a garantia.' },
];

export const PASSOS_DO_DINHEIRO = [
  { titulo: 'O boleto sai', texto: '10 dias antes do vencimento, pelo WhatsApp do inquilino.' },
  { titulo: 'O inquilino paga', texto: 'O banco avisa. Se atrasar, a régua de lembretes começa sozinha.' },
  { titulo: 'Entra no extrato', texto: 'O aluguel entra; a taxa e os descontos saem.' },
  { titulo: 'Você monta o lote', texto: 'Confere quem recebe e quanto.' },
  { titulo: 'O PIX sai', texto: 'Só com a sua aprovação e o código do banco.' },
];

/** Despesa de condomínio que, pelo nome, costuma ser extraordinária (paga pelo proprietário). */
export const PARECE_EXTRAORDINARIA =
  /fundo de reserva|fachada|reforma|obra|estrutur|equipamento|seguran|interfone novo|decora|indeniza|lazer|pintura externa|benfeitoria/i;

export const LEI_CONDOMINIO =
  'Lei 8.245, art. 23: o inquilino paga as despesas ordinárias (salários, limpeza, água e luz da área comum, pequenos reparos). Art. 22: o proprietário paga as extraordinárias (obras, fachada, fundo de reserva, equipamentos novos). O inquilino pode pedir o comprovante do rateio.';

export const LEI_MES_VENCIDO =
  'Por padrão o boleto cobra o mês que passou (mês vencido): o boleto de dezembro cobra novembro. Cobrar adiantado só é permitido em contrato sem garantia (Lei 8.245, arts. 20 e 42).';
