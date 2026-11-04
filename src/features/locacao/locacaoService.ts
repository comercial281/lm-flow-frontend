import api from '@/services/core/api';
import type { BlocoDoContrato } from './ctBlocos';
import type {
  AbaDaFicha, Acerto, AvisoDoPainel, Chaves, Cobranca, Comissao, Condominio, ConfigDaLocacao, ContaDeTerceiro, Contrato,
  DadosDeNovoContrato, Extrato, LancamentoDoExtrato, ListaDeCobrancas, MensagemDoSistema, Painel, ParametrosDoAcerto,
  Qualificacao, Reajuste, Repasse, RespostaDosRepasses, SaldoDoProprietario, SegundaVia, Severidade, StatusDoContrato, Vistoria,
} from './tipos';

/*
 * Contrato da API: docs/locacao/API.md do backend (tudo sob /api/v1/locacao).
 * Os corpos são CHATOS (sem raiz `{ contrato: ... }`). Onde o formato do
 * servidor difere do que as telas usam, a tradução mora aqui, numa função
 * `de*` por resposta, e as telas só conhecem os tipos de ./tipos.
 * 403 = Locação desligada na conta.
 */

const BASE = '/locacao';

type Resposta<T> = { data: { data: T; meta?: Record<string, unknown> } };
const miolo = async <T>(p: Promise<Resposta<T>>): Promise<T> => (await p).data.data;

/** A API devolve 403 quando a Locação não está ligada nesta conta. */
export function locacaoDesligada(e: unknown): boolean {
  return (e as { response?: { status?: number } })?.response?.status === 403;
}

const statusDe = (e: unknown) => (e as { response?: { status?: number } })?.response?.status;
const mensagemDe = (e: unknown): string | undefined => {
  const d = (e as { response?: { data?: { error?: { message?: string } | string; message?: string } } })?.response?.data;
  if (!d) return undefined;
  if (typeof d.error === 'string') return d.error;
  return d.error?.message ?? d.message;
};

export interface FiltrosDeContratos {
  status?: StatusDoContrato | 'todos';
  q?: string;
}

/* ---------- traduções servidor -> tela ---------- */

type AcaoDoServidor =
  | { tipo: 'ver_boleto'; cobranca_id: string; contrato_id: string }
  | { tipo: 'gerar'; ref: string; contrato_ids: string[] }
  | { tipo: 'abrir_contrato'; contrato_id: string; aba: AbaDaFicha }
  | { tipo: 'ir_repasses' }
  | { tipo: 'ver_extrato'; proprietario_chave: string };

export interface PainelDoServidor {
  kpis: {
    contratos_ativos: { quantidade: number; aluguel_mensal: number };
    em_atraso: { quantidade: number; valor: number };
    a_repassar: { valor: number; proprietarios: number };
    receita_30_dias: number;
  };
  avisos: { severidade: Severidade; titulo: string; detalhe: string; acao?: AcaoDoServidor | null }[];
}

const TAG: Record<Severidade, string> = { bad: 'Urgente', warn: 'Atenção', info: 'Aviso', ok: 'Tudo certo' };

export function dePainel(p: PainelDoServidor): Painel {
  const k = p.kpis;
  return {
    kpis: {
      em_atraso_total: k.em_atraso?.valor ?? 0,
      em_atraso_qtd: k.em_atraso?.quantidade ?? 0,
      contratos_ativos: k.contratos_ativos?.quantidade ?? 0,
      aluguel_mensal_total: k.contratos_ativos?.aluguel_mensal ?? 0,
      a_repassar_total: k.a_repassar?.valor ?? 0,
      proprietarios_a_repassar: k.a_repassar?.proprietarios ?? 0,
      receita_30_dias: k.receita_30_dias ?? 0,
    },
    avisos: (p.avisos ?? []).map((a, i): AvisoDoPainel => {
      const base = { id: `aviso-${i}`, sev: a.severidade, tag: TAG[a.severidade] ?? 'Aviso', titulo: a.titulo, descricao: a.detalhe };
      const ac = a.acao;
      switch (ac?.tipo) {
        case 'ver_boleto':
          return { ...base, acao_rotulo: 'Ver boletos', acao_tipo: 'contrato', contrato_id: ac.contrato_id, aba_do_contrato: 'cobrancas' };
        case 'gerar':
          return { ...base, acao_rotulo: 'Gerar boletos', acao_tipo: 'cobrancas' };
        case 'abrir_contrato':
          return { ...base, acao_rotulo: 'Abrir contrato', acao_tipo: 'contrato', contrato_id: ac.contrato_id, aba_do_contrato: ac.aba };
        case 'ir_repasses':
        case 'ver_extrato':
          return { ...base, acao_rotulo: 'Ver repasses', acao_tipo: 'repasses' };
        default:
          return base;
      }
    }),
  };
}

export interface ReajusteDoServidor {
  aniversario: string;
  indice_acumulado_pct: number;
  aplicado_pct: number;
  aluguel_atual: number;
  aluguel_novo: number;
  meses: { mes: string; indice_pct: number }[];
}

/** Libera 45 dias antes do aniversário, como no protótipo aprovado. */
export const DIAS_ANTES_DO_REAJUSTE = 45;

const somarMeses = (iso: string, n: number) => {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
};

/** Dias de hoje (no fuso de quem usa) até a data ISO; negativo = já passou. */
export function diasAte(iso: string, hoje = new Date()): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const h = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((Date.UTC(a, m - 1, d) - h) / 86_400_000);
}

/** Aluguel em vigor. A lista de contratos do servidor é um resumo: traz `aluguel_atual` pronto e não traz o histórico. */
export const aluguelHoje = (c: Contrato) => {
  if (typeof c.aluguel_atual === 'number') return c.aluguel_atual;
  const h = c.historico_aluguel ?? [];
  return h.length ? h[h.length - 1].valor : c.aluguel_inicial;
};

export function deReajuste(r: ReajusteDoServidor, c: Contrato, hoje = new Date()): Reajuste {
  let fator = 1;
  const meses = (r.meses ?? []).map(m => {
    fator *= 1 + m.indice_pct / 100;
    return { mes: m.mes, indice_mes: m.indice_pct / 100, acumulado: fator - 1 };
  });
  const dias = diasAte(r.aniversario, hoje);
  return {
    indice: c.indice,
    aniversario: r.aniversario,
    aluguel_atual: r.aluguel_atual,
    aluguel_novo: r.aluguel_novo,
    pct: r.aplicado_pct / 100,
    acumulado: r.indice_acumulado_pct / 100,
    meses,
    dias_para_aniversario: dias,
    pode_aplicar: c.status === 'ativo' && dias <= DIAS_ANTES_DO_REAJUSTE,
    erro: null,
  };
}

/** Índice do mês ainda não publicado pelo Banco Central: o servidor responde 422 com o motivo. */
export function reajusteSemIndice(c: Contrato, erro: string, hoje = new Date()): Reajuste {
  const aniversario = somarMeses(c.ultimo_reajuste ?? c.inicio, 12);
  const atual = aluguelHoje(c);
  return {
    indice: c.indice, aniversario, aluguel_atual: atual, aluguel_novo: atual, pct: 0, acumulado: 0, meses: [],
    dias_para_aniversario: diasAte(aniversario, hoje), pode_aplicar: false, erro,
  };
}

export type SegundaViaDoServidor = Cobranca & {
  encargos?: { dias: number; multa: number; juros: number; total: number };
  imovel_endereco?: string | null;
  imovel_descricao?: string | null;
};

export function deSegundaVia(b: SegundaViaDoServidor): SegundaVia {
  const e = b.encargos;
  return {
    ...b,
    multa_hoje: e?.multa ?? 0,
    juros_hoje: e?.juros ?? 0,
    total_hoje: e?.total ?? b.total,
    dias_atraso: e?.dias ?? 0,
    endereco: b.imovel_endereco || b.imovel_descricao || '',
  };
}

type LancamentoDoServidor = Omit<LancamentoDoExtrato, 'imovel' | 'inquilino'> & {
  imovel?: string | null;
  imovel_descricao?: string | null;
  inquilino?: string | null;
  inquilino_nome?: string | null;
};
export interface ExtratoDoServidor {
  proprietario_chave: string;
  nome?: string | null;
  doc?: string | null;
  pix_chave?: string | null;
  saldo: number;
  entradas?: number;
  descontos?: number;
  lancamentos: LancamentoDoServidor[];
}

export function deExtrato(x: ExtratoDoServidor): Extrato {
  const lancamentos = (x.lancamentos ?? []).map((l): LancamentoDoExtrato => ({
    ...l,
    imovel: l.imovel ?? l.imovel_descricao ?? '',
    inquilino: l.inquilino ?? l.inquilino_nome ?? null,
  }));
  const somar = (f: (v: number) => boolean) => lancamentos.reduce((s, l) => (f(l.valor) ? s + l.valor : s), 0);
  return {
    chave: x.proprietario_chave,
    nome: x.nome || x.proprietario_chave,
    doc: x.doc ?? null,
    pix_chave: x.pix_chave ?? null,
    entradas: x.entradas ?? somar(v => v > 0),
    descontos: x.descontos ?? somar(v => v < 0),
    saldo: x.saldo,
    lancamentos,
  };
}

export interface ProprietarioDoServidor {
  chave: string;
  nome?: string | null;
  pix_chave?: string | null;
  saldo: number;
  liberado: number;
  libera_em?: string | null;
  contratos?: number;
}

export function deRepasses(repasses: Repasse[], donos: ProprietarioDoServidor[], prazo: number): RespostaDosRepasses {
  const noLote = new Map<string, number>();
  for (const r of repasses) {
    if (r.status === 'aguardando') noLote.set(r.proprietario_chave, (noLote.get(r.proprietario_chave) ?? 0) + r.valor);
  }
  return {
    repasses,
    prazo_dias_uteis: prazo,
    saldos: donos.map((d): SaldoDoProprietario => ({
      chave: d.chave,
      nome: d.nome || d.chave,
      pix_chave: d.pix_chave ?? null,
      saldo: d.saldo,
      liberado: d.liberado,
      no_lote: noLote.get(d.chave) ?? 0,
      libera_em: d.libera_em ?? null,
      imoveis: d.contratos ?? 0,
    })),
  };
}

type AcertoDoServidor = Omit<Acerto, 'antes_do_prazo'> & { antes_do_fim: boolean };
const deAcerto = (a: AcertoDoServidor): Acerto => ({ ...a, antes_do_prazo: a.antes_do_fim });

type ContratoDoServidor = Contrato & { autentique_status?: string | null };
export const deContrato = (c: ContratoDoServidor): Contrato =>
  ({ ...c, autentique_document_status: c.autentique_document_status ?? c.autentique_status ?? null });

const contrato$ = async (p: Promise<Resposta<ContratoDoServidor>>) => deContrato(await miolo(p));

export const locacaoService = {
  painel: async () => dePainel(await miolo<PainelDoServidor>(api.get(`${BASE}/painel`))),

  config: () => miolo<ConfigDaLocacao>(api.get(`${BASE}/config`)),
  salvarConfig: (config: Partial<ConfigDaLocacao>) => miolo<ConfigDaLocacao>(api.patch(`${BASE}/config`, config)),

  async contratos(f: FiltrosDeContratos = {}): Promise<Contrato[]> {
    const params: Record<string, string | number> = { per_page: 200 };
    if (f.status && f.status !== 'todos') params.status = f.status;
    if (f.q?.trim()) params.q = f.q.trim();
    return (await miolo<ContratoDoServidor[]>(api.get(`${BASE}/contratos`, { params }))).map(deContrato);
  },
  contrato: (id: string) => contrato$(api.get(`${BASE}/contratos/${id}`)),
  criarContrato: (contrato: DadosDeNovoContrato) => contrato$(api.post(`${BASE}/contratos`, contrato)),
  salvarContrato: (id: string, contrato: Partial<Contrato> & { qualificacao?: Qualificacao }) =>
    contrato$(api.patch(`${BASE}/contratos/${id}`, contrato)),
  excluirContrato: (id: string) => api.delete(`${BASE}/contratos/${id}`),

  cobrancasDoContrato: (id: string) => miolo<Cobranca[]>(api.get(`${BASE}/contratos/${id}/cobrancas`)),
  async cobrancasDoMes(ref: string): Promise<ListaDeCobrancas> {
    const res = await api.get(`${BASE}/cobrancas`, { params: { ref, per_page: 500 } });
    const corpo = res.data as { data: Cobranca[]; meta?: { sem_boleto?: number } };
    return { cobrancas: corpo.data ?? [], sem_boleto: corpo.meta?.sem_boleto ?? 0 };
  },
  cobrancasAtrasadas: () => miolo<Cobranca[]>(api.get(`${BASE}/cobrancas`, { params: { atrasadas: 1, per_page: 500 } })),
  async gerarCobrancas(ref: string, contratoIds?: string[]): Promise<{ geradas: number }> {
    const r = await miolo<{ criados: number }>(api.post(`${BASE}/cobrancas/gerar`, { ref, ...(contratoIds ? { contrato_ids: contratoIds } : {}) }));
    return { geradas: r.criados ?? 0 };
  },
  pagarCobranca: (id: string, data: string) => miolo<Cobranca>(api.post(`${BASE}/cobrancas/${id}/pagar`, { data })),
  cancelarCobranca: (id: string) => miolo<Cobranca>(api.post(`${BASE}/cobrancas/${id}/cancelar`)),
  segundaVia: async (id: string) => deSegundaVia(await miolo<SegundaViaDoServidor>(api.get(`${BASE}/cobrancas/${id}/2via`))),
  enviarSegundaVia: (id: string) => miolo<{ enviada: boolean; status?: string }>(api.post(`${BASE}/cobrancas/${id}/2via/enviar`)),

  extrato: async (chave: string) =>
    deExtrato(await miolo<ExtratoDoServidor>(api.get(`${BASE}/proprietarios/${encodeURIComponent(chave)}/extrato`))),
  async repasses(): Promise<RespostaDosRepasses> {
    const [repasses, donos, config] = await Promise.all([
      miolo<Repasse[]>(api.get(`${BASE}/repasses`)),
      miolo<ProprietarioDoServidor[]>(api.get(`${BASE}/proprietarios`)),
      miolo<ConfigDaLocacao>(api.get(`${BASE}/config`)),
    ]);
    return deRepasses(repasses, donos, config.prazo_repasse_dias_uteis);
  },
  montarLote: () => miolo<{ montados: number }>(api.post(`${BASE}/repasses/montar`)),
  enviarLote: () => miolo<{ enviados: number; falhas: number }>(api.post(`${BASE}/repasses/enviar`)),
  cancelarRepasse: (id: string) => miolo<unknown>(api.post(`${BASE}/repasses/${id}/cancelar`)),
  comissoes: () => miolo<Comissao[]>(api.get(`${BASE}/comissoes`)),
  pagarComissao: (id: string) => miolo<Comissao>(api.post(`${BASE}/comissoes/${id}/pagar`)),
  terceiros: () => miolo<ContaDeTerceiro[]>(api.get(`${BASE}/terceiros`)),
  pagarTerceiro: (id: string) => miolo<ContaDeTerceiro>(api.post(`${BASE}/terceiros/${id}/pagar`)),

  condominios: () => miolo<Condominio[]>(api.get(`${BASE}/condominios`)),
  lancarCondominio: (dados: { contrato_id: string; competencia: string; linhas: { desc: string; valor: number; tipo: 'ord' | 'ext' }[] }) =>
    miolo<Condominio>(api.post(`${BASE}/condominios`, dados)),

  async reajuste(c: Contrato): Promise<Reajuste> {
    try {
      return deReajuste(await miolo<ReajusteDoServidor>(api.get(`${BASE}/contratos/${c.id}/reajuste`)), c);
    } catch (e) {
      if (statusDe(e) === 422) return reajusteSemIndice(c, mensagemDe(e) ?? 'Os índices desse período ainda não foram publicados.');
      throw e;
    }
  },
  async aplicarReajuste(id: string, aniversario?: string): Promise<Contrato> {
    const r = await miolo<{ contrato: ContratoDoServidor }>(api.post(`${BASE}/contratos/${id}/reajuste`, aniversario ? { aniversario } : {}));
    return deContrato(r.contrato);
  },
  salvarVistoria: (id: string, vistoria: Vistoria) => contrato$(api.patch(`${BASE}/contratos/${id}/vistoria`, { vistoria })),
  salvarChaves: (id: string, chaves: Chaves) => contrato$(api.patch(`${BASE}/contratos/${id}/chaves`, { chaves })),
  acerto: async (id: string, p: ParametrosDoAcerto) =>
    deAcerto(await miolo<AcertoDoServidor>(api.get(`${BASE}/contratos/${id}/acerto`, { params: p }))),
  async encerrar(id: string, p: ParametrosDoAcerto): Promise<Contrato> {
    const r = await miolo<{ contrato: ContratoDoServidor }>(api.post(`${BASE}/contratos/${id}/encerrar`, { encerramento: p }));
    return deContrato(r.contrato);
  },

  mensagens: () => miolo<MensagemDoSistema[]>(api.get(`${BASE}/mensagens`, { params: { per_page: 200 } })),

  /** O servidor devolve só o documento; a ficha precisa do contrato inteiro, então relê. */
  async salvarDocumento(id: string, html: string, blocos: BlocoDoContrato[]): Promise<Contrato> {
    await api.put(`${BASE}/contratos/${id}/documento`, { html, blocos });
    return locacaoService.contrato(id);
  },
  async baixarDocx(id: string): Promise<Blob> {
    const res = await api.get(`${BASE}/contratos/${id}/documento.docx`, { responseType: 'blob' });
    return res.data as Blob;
  },
  async enviarParaAssinatura(id: string): Promise<Contrato> {
    await api.post(`${BASE}/contratos/${id}/assinatura`);
    return locacaoService.contrato(id);
  },

  rodarRotina: () => miolo<unknown>(api.post(`${BASE}/rotina`)),
};
