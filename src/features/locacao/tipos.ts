// Tipos da Locação. Os nomes de campo vêm do docs/locacao/SPEC.md (seção "Banco"
// e "API"); o que o SPEC não fecha está marcado com "assumido" e listado no
// locacaoService.ts, para conferir contra o backend.

export type Severidade = 'bad' | 'warn' | 'info' | 'ok';

export type TipoGarantia = 'caucao' | 'fianca' | 'seguro' | 'titulo' | 'outra' | 'nenhuma';
export type Intermediacao = 'nao' | 'cheio' | 'proporcional';
export type ModoDeCobranca = 'vencido' | 'antecipado';
export type IndiceDeReajuste = 'IGP-M' | 'IPCA';
export type PoliticaNegativo = 'manter' | 'aplicar';
export type UsoDoImovel = 'residencial' | 'comercial';
export type DestinoDoDinheiro = 'prop' | 'terc' | 'imob' | 'caucao';
export type StatusDoContrato = 'ativo' | 'encerrado';
export type StatusDaCobranca = 'aberta' | 'paga' | 'acerto' | 'quitada_caucao' | 'cancelada';
export type MotivoDoEncerramento = 'fim' | 'antecipada' | 'despejo';

export interface Garantia {
  tipo: TipoGarantia;
  valor: number;
  desde?: string | null;
  detalhe?: string | null;
  vence?: string | null;
  mensal?: number | null;
}

export interface ItemDoAluguel {
  desde: string;
  valor: number;
  pct: number | null;
  indice?: string | null;
}

export interface Iptu {
  resp: 'inq' | 'prop' | 'nao';
  parcela: number;
}

export interface Recorrente {
  id: string;
  desc: string;
  valor: number;
  dest: DestinoDoDinheiro;
}

export interface AjustePendente {
  desc: string;
  valor: number;
  dest?: DestinoDoDinheiro | null;
  tipo?: string | null;
}

export interface EventoDoContrato {
  data: string;
  texto: string;
}

export interface EncerramentoDoContrato {
  motivo: MotivoDoEncerramento;
  aviso_dado?: boolean;
  isento?: boolean;
  multa_meses?: number | null;
  rend_caucao_mes?: number | null;
}

export interface ChavesRegistro {
  assinado: boolean;
  data?: string | null;
  jogos?: number | null;
  porJogo?: number | null;
  controles?: number | null;
  recebeu?: string | null;
  obs?: string | null;
}

export interface Chaves {
  entrega: ChavesRegistro;
  devolucao: ChavesRegistro;
}

export interface ItemDeVistoria {
  nome: string;
  estado?: string | null;
  obs?: string | null;
  fotos?: string[];
  novo?: boolean;
}

export interface ComodoDeVistoria {
  nome: string;
  novo?: boolean;
  itens: ItemDeVistoria[];
}

export interface ItemDaSaida {
  estado?: string | null;
  obs?: string | null;
  decisao?: 'desgaste' | 'dano' | null;
  custo?: number | null;
}

export interface Vistoria {
  entrada: { concluida: boolean; data?: string | null; feita_por?: string | null; comodos: ComodoDeVistoria[] };
  saida: { concluida: boolean; data?: string | null; feita_por?: string | null; itens: Record<string, ItemDaSaida> };
}

/** Dados que o cadastro não tem e o contrato pede (assumido: `qualificacao` jsonb no contrato). */
export interface PessoaQualificada {
  qual?: string;
  rg?: string;
  end?: string;
}

export interface Qualificacao {
  prop?: PessoaQualificada;
  inq?: PessoaQualificada;
  fiador?: string;
  compl?: string;
  matricula?: string;
  cidade?: string;
}

export interface Contrato {
  id: string;
  codigo?: string | null;
  status: StatusDoContrato;
  property_id?: string | null;
  imovel_descricao: string;
  imovel_endereco?: string | null;
  uso?: UsoDoImovel;
  proprietario_owner_id?: string | null;
  proprietario_nome: string;
  proprietario_doc?: string | null;
  proprietario_email?: string | null;
  proprietario_telefone?: string | null;
  proprietario_pix_chave?: string | null;
  proprietario_pix_tipo?: string | null;
  inquilino_contact_id?: string | null;
  inquilino_nome: string;
  inquilino_doc?: string | null;
  inquilino_email?: string | null;
  inquilino_telefone?: string | null;
  inicio: string;
  meses: number;
  dia_vencimento: number;
  aluguel_inicial: number;
  historico_aluguel: ItemDoAluguel[];
  indice: IndiceDeReajuste;
  politica_negativo: PoliticaNegativo;
  cobranca: ModoDeCobranca;
  taxa_adm_pct: number;
  intermediacao: Intermediacao;
  corretor_locacao?: string | null;
  corretor_captacao?: string | null;
  garantia: Garantia;
  condominio_estimado: number;
  iptu: Iptu;
  seguro_incendio: number;
  recorrentes?: Recorrente[];
  ajustes_pendentes?: AjustePendente[];
  ultimo_reajuste?: string | null;
  saida?: string | null;
  vistoria?: Vistoria;
  chaves?: Chaves;
  encerramento?: EncerramentoDoContrato | null;
  eventos?: EventoDoContrato[];
  qualificacao?: Qualificacao | null;
  documento_html?: string | null;
  documento_blocos?: unknown;
  autentique_document_status?: string | null;
  autentique_links?: unknown;
  /** Só na lista (assumido): quantos boletos vencidos e quanto devem. */
  em_atraso_qtd?: number;
  em_atraso_total?: number;
}

export interface ItemDaCobranca {
  desc: string;
  valor: number;
  dest: DestinoDoDinheiro;
  tipo?: string | null;
  estimado?: boolean;
}

export interface Cobranca {
  id: string;
  contrato_id: string;
  contrato_codigo?: string | null;
  imovel_descricao?: string;
  inquilino_nome?: string;
  tipo: 'mensal' | 'final';
  ref: string;
  competencia?: string | null;
  periodo_ini?: string | null;
  periodo_fim?: string | null;
  vencimento: string;
  itens: ItemDaCobranca[];
  total: number;
  status: StatusDaCobranca;
  primeira?: boolean;
  garantido_em?: string | null;
  pago_em?: string | null;
  multa?: number;
  juros?: number;
  valor_pago?: number | null;
  provedor?: string | null;
  link_boleto?: string | null;
  linha_digitavel?: string | null;
  pix_copia_cola?: string | null;
}

/** 2ª via: a cobrança com multa e juros do dia (assumido). */
export interface SegundaVia extends Cobranca {
  multa_hoje: number;
  juros_hoje: number;
  total_hoje: number;
  dias_atraso: number;
  endereco: string;
}

export interface AvisoDoPainel {
  id: string;
  sev: Severidade;
  tag: string;
  titulo: string;
  descricao: string;
  acao_rotulo?: string | null;
  /** Para onde o botão leva (assumido): aba do painel ou ficha do contrato. */
  acao_tipo?: 'cobrancas' | 'repasses' | 'contrato' | 'condominio' | 'regras' | null;
  contrato_id?: string | null;
  aba_do_contrato?: AbaDaFicha | null;
}

export interface Painel {
  kpis: {
    em_atraso_total: number;
    em_atraso_qtd: number;
    contratos_ativos: number;
    aluguel_mensal_total: number;
    a_repassar_total: number;
    no_lote_total: number;
    receita_30_dias: number;
  };
  avisos: AvisoDoPainel[];
}

export interface SaldoDoProprietario {
  chave: string;
  nome: string;
  pix_chave?: string | null;
  saldo: number;
  liberado: number;
  no_lote: number;
  libera_em?: string | null;
  imoveis: number;
}

export interface Repasse {
  id: string;
  proprietario_chave: string;
  proprietario_nome: string;
  valor: number;
  status: 'aguardando' | 'enviado' | 'cancelado';
  enviado_em?: string | null;
}

export interface RespostaDosRepasses {
  repasses: Repasse[];
  saldos: SaldoDoProprietario[];
  prazo_dias_uteis: number;
}

export interface Comissao {
  id: string;
  contrato_id: string;
  imovel_descricao: string;
  papel: 'locação' | 'captação';
  nome: string;
  pct: number;
  base: number;
  valor: number;
  pago: boolean;
}

export interface ContaDeTerceiro {
  id: string;
  contrato_id: string;
  imovel_descricao: string;
  descricao: string;
  valor: number;
  pago: boolean;
}

export interface LancamentoDoExtrato {
  contrato_codigo?: string | null;
  contrato_id: string;
  imovel: string;
  inquilino?: string | null;
  data: string;
  descricao: string;
  valor: number;
  tipo?: string | null;
  disponivel_em?: string | null;
  repasse_id?: string | null;
  repasse_status?: 'aguardando' | 'enviado' | null;
  repassado_em?: string | null;
}

export interface Extrato {
  chave: string;
  nome: string;
  doc?: string | null;
  pix_chave?: string | null;
  entradas: number;
  descontos: number;
  saldo: number;
  lancamentos: LancamentoDoExtrato[];
}

export interface LinhaDeCondominio {
  desc: string;
  valor: number;
  tipo: 'ord' | 'ext';
}

export interface Condominio {
  id: string;
  contrato_id: string;
  imovel_descricao: string;
  competencia: string;
  linhas: LinhaDeCondominio[];
  ordinarias: number;
  extraordinarias: number;
}

export interface MensagemDoSistema {
  id: string;
  data: string;
  para_nome: string;
  destinatario_tipo: 'inquilino' | 'proprietario' | 'equipe';
  canal: 'WhatsApp' | 'Interno';
  texto: string;
  status?: 'enviada' | 'registrada' | 'bloqueada_demo' | 'falhou';
  erro?: string | null;
}

export interface ConfigDaLocacao {
  multa_pct: number;
  juros_mes_pct: number;
  encargos_para: 'prop' | 'imob';
  taxa_boleto: number;
  prazo_repasse_dias_uteis: number;
  comissao_locacao_pct: number;
  comissao_captacao_pct: number;
  taxa_adm_padrao: number;
  provedor: 'manual' | 'asaas';
  asaas_ambiente: 'sandbox' | 'producao';
  /** Voltam mascarados do servidor; só se manda de novo quando a pessoa digita um novo. */
  asaas_api_key?: string | null;
  asaas_webhook_token?: string | null;
  whatsapp_ativo: boolean;
  dias_antes_gerar_boleto: number;
}

export interface ReajusteMes {
  mes: string;
  indice_mes: number;
  acumulado: number;
}

export interface Reajuste {
  indice: IndiceDeReajuste;
  aniversario: string;
  aluguel_atual: number;
  aluguel_novo: number;
  /** Já com a política de índice negativo aplicada (fração: 0,0450 = 4,5%). */
  pct: number;
  acumulado: number;
  meses: ReajusteMes[];
  dias_para_aniversario: number;
  pode_aplicar: boolean;
  erro?: string | null;
}

export interface LinhaDoAcerto {
  desc: string;
  valor: number;
  dest: 'prop' | 'aberto' | 'caucao';
}

export interface Acerto {
  saida: string;
  antes_do_prazo: boolean;
  linhas: LinhaDoAcerto[];
  total: number;
}

export interface ParametrosDoAcerto {
  saida?: string;
  motivo: MotivoDoEncerramento;
  multa_meses?: number;
  rend_caucao_mes?: number;
  isento?: boolean;
  aviso_dado?: boolean;
}

export type AbaDaFicha = 'resumo' | 'cobrancas' | 'reajuste' | 'chaves' | 'encerramento' | 'contrato';
export type AbaDaLocacao = 'painel' | 'contratos' | 'cobrancas' | 'repasses' | 'condominio' | 'mensagens' | 'regras';

export interface ListaDeCobrancas {
  cobrancas: Cobranca[];
  /** Quantos contratos ativos ainda não têm boleto do mês pedido. */
  sem_boleto: number;
}

export interface DadosDeNovoContrato {
  imovel_descricao: string;
  imovel_endereco?: string;
  uso: UsoDoImovel;
  proprietario_owner_id?: string | null;
  proprietario_nome: string;
  proprietario_doc?: string;
  proprietario_pix_chave?: string;
  inquilino_nome: string;
  inquilino_doc?: string;
  inquilino_telefone?: string;
  corretor_locacao?: string;
  corretor_captacao?: string;
  aluguel_inicial: number;
  dia_vencimento: number;
  inicio: string;
  meses: number;
  cobranca: ModoDeCobranca;
  indice: IndiceDeReajuste;
  politica_negativo: PoliticaNegativo;
  taxa_adm_pct: number;
  intermediacao: Intermediacao;
  garantia: Garantia;
  condominio_estimado: number;
  iptu: Iptu;
  seguro_incendio: number;
}
