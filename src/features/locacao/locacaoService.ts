import api from '@/services/core/api';
import type { BlocoDoContrato } from './ctBlocos';
import type {
  Acerto, Cobranca, Comissao, Condominio, ConfigDaLocacao, ContaDeTerceiro, Contrato, DadosDeNovoContrato, Extrato,
  ListaDeCobrancas, MensagemDoSistema, Painel, ParametrosDoAcerto, Reajuste, RespostaDosRepasses, SegundaVia,
  StatusDoContrato, Vistoria, Chaves, Qualificacao,
} from './tipos';

/*
 * Rotas e campos que esta tela espera (tudo sob /api/v1/locacao). As do
 * docs/locacao/SPEC.md vão como estão; as marcadas ASSUMIDO a tela precisou e o
 * SPEC não fecha, então o backend confere:
 *
 *   GET    painel                         { kpis{...}, avisos[...] }                ASSUMIDO (formato)
 *   GET    config      PATCH config       corpo { config: {...} }                    ASSUMIDO (raiz)
 *   GET    contratos?status&q&page        lista, cada item com em_atraso_qtd/_total ASSUMIDO
 *   POST   contratos                      corpo { contrato: DadosDeNovoContrato }    ASSUMIDO (raiz)
 *   GET/PATCH/DELETE contratos/:id        PATCH corpo { contrato: {...} } (inclui qualificacao, jsonb) ASSUMIDO
 *   GET    contratos/:id/cobrancas
 *   GET    cobrancas?ref=AAAA-MM          listagem do mês, meta.sem_boleto           ASSUMIDO (rota)
 *   GET    cobrancas?atrasadas=1          boletos vencidos de qualquer mês           ASSUMIDO (rota)
 *   POST   cobrancas/gerar                { ref, contrato_ids? }
 *   POST   cobrancas/:id/pagar            { data }
 *   POST   cobrancas/:id/cancelar
 *   GET    cobrancas/:id/2via             cobrança + multa_hoje/juros_hoje/total_hoje/dias_atraso/endereco ASSUMIDO
 *   POST   cobrancas/:id/2via/enviar      manda a 2ª via no WhatsApp                 ASSUMIDO (rota)
 *   GET    proprietarios/:chave/extrato   { chave, nome, doc, pix_chave, entradas, descontos, saldo, lancamentos[] } ASSUMIDO (formato)
 *   GET    repasses                       { repasses, saldos, prazo_dias_uteis }     ASSUMIDO (formato)
 *   POST   repasses/montar | repasses/enviar | repasses/:id/cancelar
 *   GET    comissoes | POST comissoes/:id/pagar
 *   GET    terceiros | POST terceiros/:id/pagar
 *   GET/POST condominios
 *   GET/POST contratos/:id/reajuste       GET: { indice, aniversario, aluguel_atual, aluguel_novo, pct, acumulado, meses[], dias_para_aniversario, pode_aplicar, erro? } ASSUMIDO
 *   PATCH  contratos/:id/vistoria         corpo { vistoria }                         ASSUMIDO
 *   PATCH  contratos/:id/chaves           corpo { chaves }                           ASSUMIDO
 *   GET    contratos/:id/acerto?saida&motivo&multa_meses&rend_caucao_mes&isento&aviso_dado ASSUMIDO (query)
 *   POST   contratos/:id/encerrar         mesmos parâmetros no corpo
 *   GET    mensagens                      itens com destinatario_tipo, para_nome, canal, texto, data
 *   PUT    contratos/:id/documento        { html, blocos }
 *   GET    contratos/:id/documento.docx   arquivo (montado no servidor)
 *   POST   contratos/:id/assinatura
 *   POST   rotina
 *
 * Valores em dinheiro e porcentagem chegam como número. 403 = Locação desligada na conta.
 */

const BASE = '/locacao';

type Resposta<T> = { data: { data: T; meta?: Record<string, unknown> } };
const miolo = async <T>(p: Promise<Resposta<T>>): Promise<T> => (await p).data.data;

/** A API devolve 403 quando a Locação não está ligada nesta conta. */
export function locacaoDesligada(e: unknown): boolean {
  return (e as { response?: { status?: number } })?.response?.status === 403;
}

export interface FiltrosDeContratos {
  status?: StatusDoContrato | 'todos';
  q?: string;
}

export const locacaoService = {
  painel: () => miolo<Painel>(api.get(`${BASE}/painel`)),

  config: () => miolo<ConfigDaLocacao>(api.get(`${BASE}/config`)),
  salvarConfig: (config: Partial<ConfigDaLocacao>) => miolo<ConfigDaLocacao>(api.patch(`${BASE}/config`, { config })),

  async contratos(f: FiltrosDeContratos = {}): Promise<Contrato[]> {
    const params: Record<string, string | number> = { per_page: 200 };
    if (f.status && f.status !== 'todos') params.status = f.status;
    if (f.q?.trim()) params.q = f.q.trim();
    return miolo<Contrato[]>(api.get(`${BASE}/contratos`, { params }));
  },
  contrato: (id: string) => miolo<Contrato>(api.get(`${BASE}/contratos/${id}`)),
  criarContrato: (contrato: DadosDeNovoContrato) => miolo<Contrato>(api.post(`${BASE}/contratos`, { contrato })),
  salvarContrato: (id: string, contrato: Partial<Contrato> & { qualificacao?: Qualificacao }) =>
    miolo<Contrato>(api.patch(`${BASE}/contratos/${id}`, { contrato })),
  excluirContrato: (id: string) => api.delete(`${BASE}/contratos/${id}`),

  cobrancasDoContrato: (id: string) => miolo<Cobranca[]>(api.get(`${BASE}/contratos/${id}/cobrancas`)),
  async cobrancasDoMes(ref: string): Promise<ListaDeCobrancas> {
    const res = await api.get(`${BASE}/cobrancas`, { params: { ref, per_page: 500 } });
    const corpo = res.data as { data: Cobranca[]; meta?: { sem_boleto?: number } };
    return { cobrancas: corpo.data ?? [], sem_boleto: corpo.meta?.sem_boleto ?? 0 };
  },
  cobrancasAtrasadas: () => miolo<Cobranca[]>(api.get(`${BASE}/cobrancas`, { params: { atrasadas: 1, per_page: 500 } })),
  gerarCobrancas: (ref: string, contratoIds?: string[]) =>
    miolo<{ geradas: number }>(api.post(`${BASE}/cobrancas/gerar`, { ref, ...(contratoIds ? { contrato_ids: contratoIds } : {}) })),
  pagarCobranca: (id: string, data: string) => miolo<Cobranca>(api.post(`${BASE}/cobrancas/${id}/pagar`, { data })),
  cancelarCobranca: (id: string) => miolo<Cobranca>(api.post(`${BASE}/cobrancas/${id}/cancelar`)),
  segundaVia: (id: string) => miolo<SegundaVia>(api.get(`${BASE}/cobrancas/${id}/2via`)),
  enviarSegundaVia: (id: string) => miolo<{ enviada: boolean }>(api.post(`${BASE}/cobrancas/${id}/2via/enviar`)),

  extrato: (chave: string) => miolo<Extrato>(api.get(`${BASE}/proprietarios/${encodeURIComponent(chave)}/extrato`)),
  repasses: () => miolo<RespostaDosRepasses>(api.get(`${BASE}/repasses`)),
  montarLote: () => miolo<{ montados: number }>(api.post(`${BASE}/repasses/montar`)),
  enviarLote: () => miolo<{ enviados: number }>(api.post(`${BASE}/repasses/enviar`)),
  cancelarRepasse: (id: string) => miolo<unknown>(api.post(`${BASE}/repasses/${id}/cancelar`)),
  comissoes: () => miolo<Comissao[]>(api.get(`${BASE}/comissoes`)),
  pagarComissao: (id: string) => miolo<Comissao>(api.post(`${BASE}/comissoes/${id}/pagar`)),
  terceiros: () => miolo<ContaDeTerceiro[]>(api.get(`${BASE}/terceiros`)),
  pagarTerceiro: (id: string) => miolo<ContaDeTerceiro>(api.post(`${BASE}/terceiros/${id}/pagar`)),

  condominios: () => miolo<Condominio[]>(api.get(`${BASE}/condominios`)),
  lancarCondominio: (dados: { contrato_id: string; competencia: string; linhas: { desc: string; valor: number; tipo: 'ord' | 'ext' }[] }) =>
    miolo<Condominio>(api.post(`${BASE}/condominios`, { condominio: dados })),

  reajuste: (id: string) => miolo<Reajuste>(api.get(`${BASE}/contratos/${id}/reajuste`)),
  aplicarReajuste: (id: string) => miolo<Contrato>(api.post(`${BASE}/contratos/${id}/reajuste`)),
  salvarVistoria: (id: string, vistoria: Vistoria) => miolo<Contrato>(api.patch(`${BASE}/contratos/${id}/vistoria`, { vistoria })),
  salvarChaves: (id: string, chaves: Chaves) => miolo<Contrato>(api.patch(`${BASE}/contratos/${id}/chaves`, { chaves })),
  acerto: (id: string, p: ParametrosDoAcerto) => miolo<Acerto>(api.get(`${BASE}/contratos/${id}/acerto`, { params: p })),
  encerrar: (id: string, p: ParametrosDoAcerto) => miolo<Contrato>(api.post(`${BASE}/contratos/${id}/encerrar`, p)),

  mensagens: () => miolo<MensagemDoSistema[]>(api.get(`${BASE}/mensagens`, { params: { per_page: 200 } })),

  salvarDocumento: (id: string, html: string, blocos: BlocoDoContrato[]) =>
    miolo<Contrato>(api.put(`${BASE}/contratos/${id}/documento`, { html, blocos })),
  async baixarDocx(id: string): Promise<Blob> {
    const res = await api.get(`${BASE}/contratos/${id}/documento.docx`, { responseType: 'blob' });
    return res.data as Blob;
  },
  enviarParaAssinatura: (id: string) => miolo<Contrato>(api.post(`${BASE}/contratos/${id}/assinatura`)),

  rodarRotina: () => miolo<unknown>(api.post(`${BASE}/rotina`)),
};
