// A janela da campanha (Tarefa 77, 01/11/2026): o que ela vende, a condição, pra quem é, qual IA atende e, no
// formulário, a entrada do lead de sempre. Serve o formulário do Meta (ficha `lead_ads_form_configs`) e o anúncio de
// WhatsApp (linha `campaign_links`). Segue com SALVAR (o cadastro do imóvel e esta janela não gravam na hora).
//
// ⚠️ "Qual IA atende" é do servidor (Tarefas 58 e 67): as opções, a confirmação de mover e a recusa vêm de lá. A
// escolha grava NA HORA (é outro endereço, o da IA), não espera o Salvar; sem a permissão da campanha, só leitura.
// ⚠️ Formulário: o `property_id` da ficha é o PRIMEIRO imóvel; a lista inteira vai em `property_ids`.
// ⚠️ Anúncio sem linha: a primeira gravação (Salvar ou escolher a IA) cria a linha (`criarLinha`).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label as UILabel,
} from '@/components/ui/ds';
import { CampoDaJanela, GradeDaJanela, GrupoDaJanela } from '@/components/base/janela';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import Aviso from '@/components/base/Aviso';
import { Seletor } from '@/components/base/Seletor';
import { BuscaDeImovel, CartaoDoImovel } from '@/components/properties/BuscaDeImovel';
import { useCan } from '@/hooks/useCan';
import { propertiesService, type Property } from '@/services/properties/propertiesService';
import {
  campanhasService, type CondicaoDaOferta, type EscopoDaOferta, type IaDaCampanha, type ItemDeCampanha,
  type LinhaDeCampanha, type OpcaoDeIa, type ReferenciaDaCampanha, type TipoDoImovel,
} from '@/services/campanhas/campanhasService';
import { leadAdsFormsService, type LeadAdsFormConfig, type LeadAdsFormConfigFormData } from '@/services/leadAds/leadAdsFormsService';
import type { Intencao } from '@/services/salesAgents/salesAgentsService';
import { motivoEscrito } from '@/features/salesAgents/erroDoServidor';
import { fraseDaIntencao, INTENCOES, ROTULO_DA_INTENCAO } from '@/features/salesAgents/intencao';
import {
  CAMPOS_DA_CONDICAO, TETO_DA_OBSERVACAO, condicaoDaLinha, condicaoEmEdicao, condicaoParaGravar, dinheiro, dinheiroNoCampo,
  type CampoDaCondicao, type CondicaoEmEdicao,
} from '@/features/campanhas/condicaoDaCampanha';
import { MAX_DE_IMOVEIS, TIPOS_DE_IMOVEL, nomeDoItem } from '@/features/campanhas/itensDeCampanha';
import { donoEmTexto, fraseDeMover, opcoesDaTela } from '@/features/campanhas/qualIaAtende';

/** O que o servidor escreveu no 409 ("esta campanha sai da IA X"), com maiúscula e ponto. Vazio = monta pelo rótulo. */
function fraseDoServidor(msg?: string | null): string | null {
  const t = (msg ?? '').trim();
  if (!t) return null;
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}${/[.!?]$/.test(t) ? '' : '.'}`;
}

export interface ResultadoDoSalvar { config?: LeadAdsFormConfig; linha?: LinhaDeCampanha }

export interface JanelaDaCampanhaProps {
  tipo: 'form' | 'whats';
  item: ItemDeCampanha;
  /** Formulário: a ficha que se edita. Sem ela, é um formulário novo (cria). */
  config?: LeadAdsFormConfig | null;
  /** Formulário: os campos de "Entrada do lead" (funil, quem assume, etiquetas...) e o conferidor deles. */
  entrada?: ReactNode;
  /** Devolve o que a entrada grava, ou nulo se faltou algo (quem chama já avisou). */
  montarEntrada?: () => LeadAdsFormConfigFormData | null;
  /** Sem as opções (servidor sem a lista), o bloco "Qual IA atende" nem aparece. */
  opcoesDeIa?: OpcaoDeIa[];
  aoFechar: () => void;
  aoSalvar?: (r: ResultadoDoSalvar) => void;
  aoMudarIa?: (item: ItemDeCampanha, donos: IaDaCampanha[]) => void;
  /** O anúncio ganhou linha ao escolher a IA: a lista guarda o id, pra reabrir não criar de novo (o servidor recusa em dobro). */
  aoCriarLinha?: (item: ItemDeCampanha, linkId: string) => void;
  aoApagar?: () => void;
}

type Imovel = Property | 'erro';

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <GrupoDaJanela titulo={titulo}>{children}</GrupoDaJanela>;
}

export default function JanelaDaCampanha({
  tipo, item, config = null, entrada, montarEntrada, opcoesDeIa, aoFechar, aoSalvar, aoMudarIa, aoCriarLinha, aoApagar,
}: JanelaDaCampanhaProps) {
  const can = useCan();
  const recurso = tipo === 'form' ? 'lead_ads_form_configs' : 'campaign_links';
  // C26: a permissão de mexer na IA da campanha é a da própria campanha (não a de editar a IA).
  // Anúncio sem linha: criar a linha pede `campaign_links.create` (o servidor exige), além de editar.
  const precisaCriar = tipo === 'whats' && !item.link_id;
  const podeCriar = !precisaCriar || can('campaign_links', 'create');
  const podeEditar = can(recurso, tipo === 'form' && !config ? 'create' : 'update') && podeCriar;
  const podeApagar = !!aoApagar && !!config && can('lead_ads_form_configs', 'delete');

  const [ids, setIds] = useState<string[]>(item.property_ids.map(String));
  // Sem tipo gravado mas com imóvel: é "imóveis escolhidos" (o mesmo que o servidor entende).
  const [escopo, setEscopo] = useState<EscopoDaOferta | null>(item.sells_scope ?? (item.property_ids.length ? 'properties' : null));
  const [tipoDeImovel, setTipoDeImovel] = useState<TipoDoImovel>(item.sells_listing_kind ?? 'development');
  const [cond, setCond] = useState<CondicaoEmEdicao>(condicaoEmEdicao(item.offer_condition));
  const [intencoes, setIntencoes] = useState<Intencao[]>(item.audience_intents ?? []);
  const [imoveis, setImoveis] = useState<Record<string, Imovel>>({});
  const [salvando, setSalvando] = useState(false);
  const [preenchendo, setPreenchendo] = useState(false);
  const [trazidoDoTexto, setTrazidoDoTexto] = useState(false);

  // "Qual IA atende"
  const [donos, setDonos] = useState<IaDaCampanha[]>(item.agents);
  const [linkId, setLinkId] = useState<string | null>(item.link_id);
  const [escolhida, setEscolhida] = useState('');
  const [movendo, setMovendo] = useState<{ chave: string; frase: string } | null>(null);
  const [iaOcupada, setIaOcupada] = useState(false);
  const [avisoDaIa, setAvisoDaIa] = useState<string | null>(null);
  const [ficouSemIa, setFicouSemIa] = useState<string[]>([]);

  // Os imóveis escolhidos: nome, código e a condição de cada um (a dica dos campos e o aviso de "vale a de cada").
  const pedidos = useRef(new Set<string>());
  useEffect(() => {
    ids.forEach((id) => {
      if (pedidos.current.has(id)) return;
      pedidos.current.add(id);
      propertiesService.get(id)
        .then((p) => setImoveis((m) => ({ ...m, [id]: p })))
        .catch(() => setImoveis((m) => ({ ...m, [id]: 'erro' })));
    });
  }, [ids]);

  const lidos = ids.map((id) => imoveis[id]).filter((p): p is Property => !!p && p !== 'erro');
  const umSo = ids.length === 1 && escopo === 'properties' ? lidos[0] ?? null : null;
  const placeholder = (campo: CampoDaCondicao, dinheiroNoCampo: boolean) => {
    if (escopo === 'properties' && ids.length > 1) return 'Vazio: vale a de cada imóvel';
    const doImovel = umSo?.[campo];
    if (doImovel != null && doImovel !== '') return `Do imóvel: ${dinheiroNoCampo ? dinheiro(Number(doImovel)) : String(doImovel)}`;
    return 'Vazio: não informado';
  };

  const mudaCond = (campo: keyof CondicaoEmEdicao, valor: string) => setCond((c) => ({ ...c, [campo]: valor }));
  const marcaIntencao = (k: Intencao, on: boolean) =>
    setIntencoes((l) => INTENCOES.filter((x) => (x === k ? on : l.includes(x))));

  const textoDoAnuncio = (item.ad_body || item.ad_title || '').trim();
  const preencherComOAnuncio = async () => {
    if (!textoDoAnuncio) return;
    setPreenchendo(true);
    try {
      const c: CondicaoDaOferta = await campanhasService.condicaoDoTexto(textoDoAnuncio);
      setCond((atual) => ({
        down_payment_from: c.down_payment_from != null ? dinheiroNoCampo(c.down_payment_from) : atual.down_payment_from,
        installment_from: c.installment_from != null ? dinheiroNoCampo(c.installment_from) : atual.installment_from,
        min_income: c.min_income != null ? dinheiroNoCampo(c.min_income) : atual.min_income,
        payment_terms: c.payment_terms || atual.payment_terms,
        note: c.note ? c.note.slice(0, TETO_DA_OBSERVACAO) : atual.note,
      }));
      setTrazidoDoTexto(true);
    } catch (e) {
      toast.error(motivoEscrito(e) ?? 'Não consegui ler o texto do anúncio. Preencha na mão.');
    } finally {
      setPreenchendo(false);
    }
  };

  // ---- Salvar ----
  const semImovel = escopo === 'properties' && ids.length === 0;
  const corpoDaOferta = () => ({
    property_ids: escopo === 'properties' ? ids : [],
    sells_scope: escopo,
    sells_listing_kind: escopo === 'listing_kind' ? tipoDeImovel : null,
    offer_condition: condicaoParaGravar(cond),
    audience_intents: intencoes,
  });

  const salvar = async () => {
    if (semImovel) { toast.error('Escolha pelo menos um imóvel.'); return; }
    setSalvando(true);
    try {
      const oferta = corpoDaOferta();
      if (tipo === 'form') {
        const base = montarEntrada ? montarEntrada() : null;
        if (!base) return;
        const payload: LeadAdsFormConfigFormData = { ...base, ...oferta, property_id: oferta.property_ids[0] ?? null };
        const salva = config ? await leadAdsFormsService.update(config.id, payload) : await leadAdsFormsService.create(payload);
        toast.success(config ? 'Configuração atualizada' : 'Configuração salva');
        aoSalvar?.({ config: salva });
      } else {
        const linha = linkId
          ? await campanhasService.atualizarLinha(linkId, oferta)
          : await campanhasService.criarLinha({
            match_kind: item.match_kind ?? 'campaign', match_value: item.match_value ?? '', label: item.label, ...oferta,
          });
        toast.success('Campanha salva');
        aoSalvar?.({ linha });
      }
      aoFechar();
    } catch (e) {
      toast.error(motivoEscrito(e) ?? 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  // ---- Qual IA atende ----
  const opcoes = opcoesDaTela(opcoesDeIa ?? [], donos);
  const refDaIa = useCallback(async (): Promise<ReferenciaDaCampanha | null> => {
    if (tipo === 'form') return config ? { kind: 'form', id: config.form_id } : null;
    if (linkId) return { kind: 'campaign_link', id: linkId };
    if (!item.match_kind || !item.match_value) return null;
    const criada = await campanhasService.criarLinha({ match_kind: item.match_kind, match_value: item.match_value, label: item.label });
    setLinkId(String(criada.id));
    aoCriarLinha?.(item, String(criada.id));
    return { kind: 'campaign_link', id: String(criada.id) };
  }, [tipo, config, linkId, item, aoCriarLinha]);

  const aplicarDonos = (r: { holders: IaDaCampanha[]; left_empty: string[]; warning: string | null }) => {
    setDonos(r.holders);
    setAvisoDaIa(r.warning);
    setFicouSemIa(r.left_empty);
    setMovendo(null);
    aoMudarIa?.(item, r.holders);
  };

  const pedir = async (chave: string, confirmar: boolean) => {
    const o = opcoes.find((x) => x.chave === chave);
    if (!o) return;
    setIaOcupada(true);
    try {
      const ref = await refDaIa();
      if (!ref) { toast.error('Salve o formulário antes de escolher a IA.'); return; }
      const r = await campanhasService.escolherIa({
        ref, sales_agent_id: o.opcao.sales_agent_id, number_id: o.opcao.number_id, ...(confirmar ? { confirm_move: true } : {}),
      });
      if (!r.ok) { setMovendo({ chave, frase: fraseDoServidor(r.message) ?? fraseDeMover(r.conflicts, opcoesDeIa ?? []) }); return; }
      aplicarDonos(r);
      setEscolhida('');
      toast.success('IA da campanha gravada');
    } catch (e) {
      toast.error(motivoEscrito(e) ?? 'Não consegui mudar a IA desta campanha.');
    } finally {
      setIaOcupada(false);
    }
  };

  const tirar = async (d: IaDaCampanha) => {
    setIaOcupada(true);
    try {
      const ref = await refDaIa();
      if (!ref) return;
      aplicarDonos(await campanhasService.tirarIa({ ref, sales_agent_id: d.sales_agent_id, number_id: d.sales_agent_number_id }));
      toast.success('IA tirada da campanha');
    } catch (e) {
      toast.error(motivoEscrito(e) ?? 'Não consegui tirar a IA desta campanha.');
    } finally {
      setIaOcupada(false);
    }
  };

  const podeMexerNaIa = podeEditar && !(tipo === 'form' && !config);
  const frase = fraseDaIntencao(intencoes, 'desta campanha');
  const linhasDeCondicao = condicaoDaLinha({ offer_condition: condicaoParaGravar(cond) }, umSo);
  const lerCartao = (id: string) => {
    const p = imoveis[id];
    if (p && p !== 'erro') return { id, title: p.title || p.code || 'Imóvel', code: p.code ?? '' };
    return { id, title: p === 'erro' ? 'Imóvel não encontrado' : '…', code: '' };
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) aoFechar(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tipo === 'form' ? (config ? 'Editar formulário do Meta' : 'Configurar formulário do Meta') : 'Editar anúncio de WhatsApp'}</DialogTitle>
          <DialogDescription>
            <strong>{nomeDoItem(item)}</strong>
            {item.campaign_name && item.kind === 'form' ? <> · Campanha {item.campaign_name}</> : null}
            {item.leads_count > 0 ? <> · {item.leads_count} {item.leads_count === 1 ? 'lead' : 'leads'} em 90 dias</> : null}
          </DialogDescription>
        </DialogHeader>

        {!podeEditar && (
          <Aviso tom="neutro" compacto>
            {!podeCriar
              ? 'Este anúncio ainda não tem linha em Campanhas, e criar a linha pede a permissão de criar campanha. Peça pro gerente ou administrador.'
              : 'Você pode ver esta campanha, mas não mudar. Quem edita é o gerente ou o administrador.'}
          </Aviso>
        )}

        <fieldset disabled={!podeEditar || salvando} className="m-0 grid min-w-0 gap-5 border-0 p-0 py-2">
          <Bloco titulo="O que esta campanha vende">
            <BotoesDeEscolha<EscopoDaOferta>
              rotulo="O que vende" semNome valor={escopo} desabilitado={!podeEditar}
              opcoes={[
                { valor: 'properties', rotulo: 'Imóveis escolhidos' },
                { valor: 'listing_kind', rotulo: 'Um tipo inteiro' },
                { valor: 'catalog', rotulo: 'Todo o catálogo' },
              ]}
              aoEscolher={setEscopo}
            />
            {escopo === 'properties' && (
              <CampoDaJanela rotulo="Imóveis" htmlFor="oferta_busca" ajuda={`De 1 a ${MAX_DE_IMOVEIS}. Busque por título ou código.`}>
                <div className="grid gap-2">
                  {ids.map((id) => (
                    <CartaoDoImovel key={id} imovel={lerCartao(id)} disabled={!podeEditar} aoTirar={() => setIds((l) => l.filter((x) => x !== id))} />
                  ))}
                  {ids.length < MAX_DE_IMOVEIS ? (
                    <BuscaDeImovel id="oferta_busca" disabled={!podeEditar}
                      aoEscolher={(p) => setIds((l) => (l.includes(p.id) || l.length >= MAX_DE_IMOVEIS ? l : [...l, p.id]))} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Chegou em {MAX_DE_IMOVEIS} imóveis, o máximo de uma campanha.</p>
                  )}
                </div>
                {ids.length > 1 && (
                  <p className="rounded-md bg-accent px-3 py-2 text-xs text-accent-foreground">
                    Com mais de um, a conversa começa sem imóvel fixo: ela descobre qual serve e o escolhido vira o imóvel da conversa.
                    {tipo === 'form' ? ' O imóvel de interesse do card só nasce quando a pessoa escolhe.' : ''}
                  </p>
                )}
                {semImovel && <p role="alert" className="text-xs text-destructive">Escolha pelo menos um imóvel.</p>}
              </CampoDaJanela>
            )}
            {escopo === 'listing_kind' && (
              <CampoDaJanela rotulo="Tipo" htmlFor="oferta_tipo" ajuda="Todos os imóveis daquele tipo. A busca da conversa fica só nele.">
                <Seletor id="oferta_tipo" value={tipoDeImovel} onChange={(e) => setTipoDeImovel(e.target.value as TipoDoImovel)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {(Object.keys(TIPOS_DE_IMOVEL) as TipoDoImovel[]).map((k) => <option key={k} value={k}>{TIPOS_DE_IMOVEL[k]}</option>)}
                </Seletor>
              </CampoDaJanela>
            )}
            {escopo === 'catalog' && <p className="text-sm text-muted-foreground">A IA não fixa imóvel: descobre o que a pessoa procura e busca no catálogo.</p>}
            {!escopo && <p className="text-sm text-muted-foreground">Ainda não diz. A IA segue pelo imóvel principal dela, e a Saúde da IA avisa.</p>}
          </Bloco>

          <Bloco titulo={tipo === 'form' ? 'Condição deste formulário' : 'Condição deste anúncio'}>
            <p className="text-xs text-muted-foreground">Só se for diferente da do imóvel. O que ficar vazio vem do cadastro do imóvel.</p>
            {tipo === 'whats' && (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={preencherComOAnuncio} disabled={!podeEditar || preenchendo || !textoDoAnuncio}
                  title={textoDoAnuncio ? undefined : 'Este anúncio não trouxe texto.'}>
                  {preenchendo ? 'Lendo o anúncio...' : 'Preencher com o texto do anúncio'}
                </Button>
                {textoDoAnuncio && <span className="min-w-0 truncate text-xs text-muted-foreground">Texto: {textoDoAnuncio}</span>}
              </div>
            )}
            {trazidoDoTexto && <Aviso tom="atencao" compacto>Trazido do texto do anúncio. Confira antes de salvar.</Aviso>}
            <GradeDaJanela>
              {CAMPOS_DA_CONDICAO.map(({ campo, rotulo, dinheiro: eDinheiro }) => (
                <CampoDaJanela key={campo} rotulo={rotulo} htmlFor={`cond_${campo}`} colunas={campo === 'payment_terms' ? 4 : 2}>
                  <Input id={`cond_${campo}`} inputMode={eDinheiro ? 'decimal' : undefined} value={cond[campo]}
                    placeholder={placeholder(campo, eDinheiro)} onChange={(e) => mudaCond(campo, e.target.value)} />
                </CampoDaJanela>
              ))}
              <CampoDaJanela rotulo={tipo === 'form' ? 'Observação do formulário' : 'Observação do anúncio'} htmlFor="cond_note" colunas={4}
                ajuda={`${cond.note.length} de ${TETO_DA_OBSERVACAO}`}>
                <textarea id="cond_note" value={cond.note} maxLength={TETO_DA_OBSERVACAO} rows={2}
                  onChange={(e) => mudaCond('note', e.target.value)}
                  placeholder="Ex.: imóveis de 30% a 70% abaixo da avaliação, a partir de R$ 115 mil"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </CampoDaJanela>
            </GradeDaJanela>
            {umSo || escopo === 'catalog' || escopo === 'listing_kind' ? (
              <ul className="grid gap-1 text-xs text-muted-foreground" aria-label="O que a IA vai usar">
                {linhasDeCondicao.map((l) => {
                  // Catálogo e tipo não fixam imóvel: o vazio vem do imóvel que a conversa escolher, não do corretor.
                  const doEscolhido = !umSo && l.de === 'o corretor simula';
                  return (
                    <li key={l.campo}>
                      <b className="font-medium text-foreground/80">{l.rotulo}:</b>{' '}
                      {doEscolhido ? 'vem do imóvel que a conversa escolher' : <>{l.valor} <span>({l.de})</span></>}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </Bloco>

          <Bloco titulo="Pra quem é este anúncio (opcional)">
            <p className="text-xs text-muted-foreground">
              Serve pra campanha "Investidor" que vende um imóvel que também serve pra morar: com Investimento marcado aqui, a IA não pergunta
              "morar ou investir?" pra quem veio dela.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {INTENCOES.map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <Checkbox id={`pq_${k}`} checked={intencoes.includes(k)} onCheckedChange={(v) => marcaIntencao(k, v === true)} />
                  <UILabel htmlFor={`pq_${k}`} className="cursor-pointer">{ROTULO_DA_INTENCAO[k]}</UILabel>
                </div>
              ))}
            </div>
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs" data-testid="frase-da-intencao">{frase.texto}</p>
          </Bloco>
        </fieldset>

        {opcoesDeIa && (
          <Bloco titulo="Qual IA atende">
            {donos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem IA nesta campanha.</p>
            ) : (
              <ul className="grid gap-2">
                {donos.map((d) => (
                  <li key={`${d.sales_agent_id}|${d.sales_agent_number_id ?? ''}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{donoEmTexto(d)}</span>
                    {podeMexerNaIa && !d.whole_number && !d.note && (
                      <Button type="button" variant="ghost" size="sm" disabled={iaOcupada} aria-label={`Tirar ${d.name}`} onClick={() => tirar(d)}>Tirar</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {podeMexerNaIa && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Seletor aria-label="Pôr numa IA" value={escolhida} disabled={iaOcupada}
                    onChange={(e) => { setEscolhida(e.target.value); setMovendo(null); }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Pôr numa IA...</option>
                    {opcoes.filter((o) => !o.jaAtende).map((o) => (
                      <option key={o.chave} value={o.chave} disabled={o.fixa}>{o.rotulo}</option>
                    ))}
                  </Seletor>
                </div>
                <Button type="button" variant="outline" disabled={!escolhida || iaOcupada} onClick={() => pedir(escolhida, false)}>Pôr</Button>
              </div>
            )}
            {tipo === 'form' && !config && <p className="text-xs text-muted-foreground">Salve o formulário primeiro; depois dá pra escolher a IA.</p>}
            {movendo && (
              <Aviso tom="atencao" titulo="Mover a campanha de IA?">
                <p>{movendo.frase}</p>
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" disabled={iaOcupada} onClick={() => pedir(movendo.chave, true)}>Mover</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setMovendo(null)}>Deixar como está</Button>
                </div>
              </Aviso>
            )}
            {avisoDaIa && <Aviso tom="atencao" compacto>{avisoDaIa}</Aviso>}
            {ficouSemIa.length > 0 && <Aviso tom="atencao" compacto>Ficou sem IA: {ficouSemIa.join(', ')}.</Aviso>}
            {podeMexerNaIa && <p className="text-xs text-muted-foreground">Esta escolha vale na hora, sem esperar o Salvar.</p>}
          </Bloco>
        )}

        {tipo === 'form' && entrada && (
          <fieldset disabled={!podeEditar || salvando} className="m-0 grid min-w-0 gap-5 border-0 p-0">
            {entrada}
          </fieldset>
        )}

        <DialogFooter>
          {podeApagar && (
            <Button type="button" variant="ghost" className="mr-auto text-destructive" onClick={aoApagar}>Excluir ficha</Button>
          )}
          <Button variant="outline" onClick={aoFechar}>{podeEditar ? 'Cancelar' : 'Fechar'}</Button>
          {podeEditar && (
            <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : tipo === 'form' && !config ? 'Criar' : 'Salvar'}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
