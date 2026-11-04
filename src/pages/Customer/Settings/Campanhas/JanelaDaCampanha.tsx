// A janela da campanha (Tarefa 77, 01/11/2026; refeita larga em 04/11/2026): duas colunas. Esquerda: o que ela vende
// e, no formulário, a entrada do lead. Direita: quem atende e a oferta (fechada, abre em "Personalizar a oferta"). Serve o formulário do Meta (ficha `lead_ads_form_configs`) e o anúncio de
// WhatsApp (linha `campaign_links`). Segue com SALVAR (o cadastro do imóvel e esta janela não gravam na hora).
//
// ⚠️ "Qual IA atende" é do servidor (Tarefas 58 e 67): as opções, a confirmação de mover e a recusa vêm de lá. A
// escolha grava NA HORA (é outro endereço, o da IA), não espera o Salvar; sem a permissão da campanha, só leitura.
// ⚠️ Formulário: o `property_id` da ficha é o PRIMEIRO imóvel; a lista inteira vai em `property_ids`.
// ⚠️ Anúncio sem linha: a primeira gravação (Salvar ou escolher a IA) cria a linha (`criarLinha`).
// ⚠️ Formulário novo + IA escolhida: Criar grava a ficha e DEPOIS a IA. Se a IA falhar (ou pedir pra mover), a ficha
// fica, a janela segue aberta em edição (`criada`) e Salvar atualiza essa ficha, nunca cria outra.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label as UILabel,
} from '@/components/ui/ds';
import { CampoDaJanela, GradeDaJanela, GrupoDaJanela } from '@/components/base/janela';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import Aviso from '@/components/base/Aviso';
import { Seletor } from '@/components/base/Seletor';
import { SeletorDeImoveis } from '@/components/properties/SeletorDeImoveis';
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
import { MAX_DE_IMOVEIS, TIPOS_DE_IMOVEL, itemDaFicha, nomeDoItem } from '@/features/campanhas/itensDeCampanha';
import { fichaParecida } from '@/features/campanhas/fichaParecida';
import { chaveDaIa, fraseDeMover, maiuscula, opcoesDaTela } from '@/features/campanhas/qualIaAtende';
import { normalizarNome } from '../LeadAdsForms/regraPorPalavra';
import QuemAtende from './QuemAtende';

/** O que o servidor escreveu no 409 ("esta campanha sai da IA X"), com maiúscula e ponto. Vazio = monta pelo rótulo. */
function fraseDoServidor(msg?: string | null): string | null {
  const t = (msg ?? '').trim();
  return t ? `${maiuscula(t)}${/[.!?]$/.test(t) ? '' : '.'}` : null;
}

export interface ResultadoDoSalvar { config?: LeadAdsFormConfig; linha?: LinhaDeCampanha }

export interface JanelaDaCampanhaProps {
  tipo: 'form' | 'whats';
  item: ItemDeCampanha;
  /** Formulário: a ficha que se edita. Sem ela, é um formulário novo (cria). */
  config?: LeadAdsFormConfig | null;
  /** Formulário: os campos de "Entrada do lead" (funil, quem assume, etiquetas...), na coluna da esquerda. */
  entrada?: ReactNode;
  /** Formulário: pra onde o lead vai, em palavras ("Funil > Etapa"), pro resumo do rodapé. */
  resumoDaEntrada?: string;
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
  /** Formulário novo: as fichas do cliente, pra sugerir "Parece com a ficha X". */
  fichas?: LeadAdsFormConfig[];
  /** A lista do servidor (traz a IA e a oferta de cada ficha). Sem ela, a cópia leva só o que a ficha sabe. */
  itensDaLista?: ItemDeCampanha[];
  /** Copiar: quem guarda a entrada do lead (funil, etapa, quem assume, etiquetas) recebe a ficha de origem. */
  aoCopiarEntrada?: (origem: LeadAdsFormConfig) => void;
  /** A lista de Campanhas (IA e oferta das fichas) ainda está chegando: Copiar espera, pra não perder a IA calado. */
  listaCarregando?: boolean;
  /** A lista não carregou: Copiar vale, mas a IA não vem e a janela avisa. */
  listaFalhou?: boolean;
}

type Imovel = Property | 'erro';

/** Fechada, a oferta diz o que vale hoje: a condição do cadastro do imóvel (ou de cada um). */
function fraseDoCadastro(escopo: EscopoDaOferta | null, qtd: number, umSo: Property | null): string {
  if (escopo === 'properties' && qtd > 1) return 'Vale a do cadastro de cada imóvel.';
  if (escopo === 'catalog' || escopo === 'listing_kind') return 'Vale a do cadastro do imóvel que a conversa escolher.';
  if (umSo) {
    const partes = condicaoDaLinha({}, umSo).filter((l) => l.de === 'do imóvel').map((l) => `${l.rotulo.toLowerCase()} ${l.valor}`);
    return partes.length ? `Vale a do cadastro do imóvel: ${partes.join(', ')}.` : 'Vale a do cadastro do imóvel, que não traz condição.';
  }
  return 'Vale a do cadastro do imóvel.';
}

const temCondicao = (c: CondicaoDaOferta | null) => Object.values(c ?? {}).some((v) => v != null && String(v).trim() !== '');

export default function JanelaDaCampanha({
  tipo, item, config = null, entrada, resumoDaEntrada, montarEntrada, opcoesDeIa, aoFechar, aoSalvar, aoMudarIa, aoCriarLinha, aoApagar, fichas, itensDaLista, aoCopiarEntrada, listaCarregando = false, listaFalhou = false,
}: JanelaDaCampanhaProps) {
  const can = useCan();
  const recurso = tipo === 'form' ? 'lead_ads_form_configs' : 'campaign_links';
  // Formulário novo que acabou de ser criado aqui (e a IA falhou): a janela segue aberta, agora em edição dessa ficha.
  const [criada, setCriada] = useState<LeadAdsFormConfig | null>(null);
  const configAtual = config ?? criada;
  const novo = tipo === 'form' && !configAtual;
  // C26: a permissão de mexer na IA da campanha é a da própria campanha (não a de editar a IA).
  // Anúncio sem linha: criar a linha pede `campaign_links.create` (o servidor exige), além de editar.
  const precisaCriar = tipo === 'whats' && !item.link_id;
  const podeCriar = !precisaCriar || can('campaign_links', 'create');
  const podeEditar = can(recurso, novo ? 'create' : 'update') && podeCriar;
  const podeApagar = !!aoApagar && !!config && can('lead_ads_form_configs', 'delete');

  const [ids, setIds] = useState<string[]>(item.property_ids.map(String));
  // Sem tipo gravado mas com imóvel: é "imóveis escolhidos" (o mesmo que o servidor entende).
  const [escopo, setEscopo] = useState<EscopoDaOferta | null>(item.sells_scope ?? (item.property_ids.length ? 'properties' : null));
  // Sem nada gravado a janela abre em "Imóveis escolhidos", com a lista à mostra, mas continua sem escopo: "o que vende" é
  // opcional, e criar sem escolher nada grava o mesmo de sempre (sem tipo, sem imóvel). Marcar um imóvel vira escolha de verdade;
  // desmarcar o último de uma escolha que não foi pedida volta a "sem escopo".
  const escopoImplicito = useRef(false);
  const escopoNaTela: EscopoDaOferta = escopo ?? 'properties';
  const escolheEscopo = (e: EscopoDaOferta) => { escopoImplicito.current = false; setEscopo(e); };
  const mudaImoveis = (novos: string[]) => {
    setIds(novos);
    if (escopo === null && novos.length > 0) { escopoImplicito.current = true; setEscopo('properties'); }
    else if (escopo === 'properties' && novos.length === 0 && escopoImplicito.current) { escopoImplicito.current = false; setEscopo(null); }
  };
  const [tipoDeImovel, setTipoDeImovel] = useState<TipoDoImovel>(item.sells_listing_kind ?? 'development');
  const [cond, setCond] = useState<CondicaoEmEdicao>(condicaoEmEdicao(item.offer_condition));
  const [intencoes, setIntencoes] = useState<Intencao[]>(item.audience_intents ?? []);
  // Anúncio sempre mostra a condição (é o que ele tem de seu); formulário só abre se a ficha já tem algo ou a pessoa pede.
  const [ofertaAberta, setOfertaAberta] = useState(tipo === 'whats' || temCondicao(item.offer_condition) || (item.audience_intents ?? []).length > 0);
  const [imoveis, setImoveis] = useState<Record<string, Imovel>>({});
  const [salvando, setSalvando] = useState(false);
  const [preenchendo, setPreenchendo] = useState(false);
  const [trazidoDoTexto, setTrazidoDoTexto] = useState(false);

  // "Quem atende"
  const [donos, setDonos] = useState<IaDaCampanha[]>(item.agents);
  const [linkId, setLinkId] = useState<string | null>(item.link_id);
  const [movendo, setMovendo] = useState<{ chave: string; frase: string } | null>(null);
  const [iaOcupada, setIaOcupada] = useState(false);
  const [avisoDaIa, setAvisoDaIa] = useState<string | null>(null);
  const [ficouSemIa, setFicouSemIa] = useState<string[]>([]);
  /** Formulário novo: a IA escolhida que só grava no Criar. */
  const [pendente, setPendente] = useState<string | null>(null);
  /** O 409 veio do Criar: se o Mover der certo, não sobra nada pra fazer na janela. */
  const fechaAoGravar = useRef(false);

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

  // ---- Qual IA atende ----
  const opcoes = opcoesDaTela(opcoesDeIa ?? [], donos);
  const opcaoPendente = pendente ? opcoes.find((o) => o.chave === pendente) : undefined;
  // A escolha que ainda não gravou aparece como dono, com o motivo dizendo que entra no Criar.
  const donoPendente: IaDaCampanha | null = novo && opcaoPendente
    ? {
      sales_agent_id: opcaoPendente.opcao.sales_agent_id, name: opcaoPendente.opcao.label, sales_agent_number_id: opcaoPendente.opcao.number_id,
      number_label: null, whole_number: false, note: null, kind: 'campaign', reason: 'entra junto quando você clicar em Criar', removable: true,
    }
    : null;
  const donosNaTela = donoPendente ? [...donos, donoPendente] : donos;
  const opcoesNaTela = opcoesDaTela(opcoesDeIa ?? [], donosNaTela);

  const refDaIa = useCallback(async (): Promise<ReferenciaDaCampanha | null> => {
    if (tipo === 'form') return configAtual ? { kind: 'form', id: configAtual.form_id } : null;
    if (linkId) return { kind: 'campaign_link', id: linkId };
    if (!item.match_kind || !item.match_value) return null;
    const criadaAgora = await campanhasService.criarLinha({ match_kind: item.match_kind, match_value: item.match_value, label: item.label });
    setLinkId(String(criadaAgora.id));
    aoCriarLinha?.(item, String(criadaAgora.id));
    return { kind: 'campaign_link', id: String(criadaAgora.id) };
  }, [tipo, configAtual, linkId, item, aoCriarLinha]);

  const aplicarDonos = (r: { holders: IaDaCampanha[]; left_empty: string[]; warning: string | null }) => {
    setDonos(r.holders);
    setAvisoDaIa(r.warning);
    setFicouSemIa(r.left_empty);
    setMovendo(null);
    aoMudarIa?.(item, r.holders);
  };

  /** Grava a IA de uma campanha que já existe. Devolve se deu certo (false = pediu pra mover, ou falhou). */
  const gravarIa = async (ref: ReferenciaDaCampanha, chave: string, confirmar: boolean): Promise<boolean> => {
    const o = opcoes.find((x) => x.chave === chave);
    if (!o) return false;
    const r = await campanhasService.escolherIa({
      ref, sales_agent_id: o.opcao.sales_agent_id, number_id: o.opcao.number_id, ...(confirmar ? { confirm_move: true } : {}),
    });
    if (!r.ok) { setMovendo({ chave, frase: fraseDoServidor(r.message) ?? fraseDeMover(r.conflicts, opcoesDeIa ?? []) }); return false; }
    aplicarDonos(r);
    return true;
  };

  const pedir = async (chave: string, confirmar: boolean) => {
    setIaOcupada(true);
    try {
      const ref = await refDaIa();
      if (!ref) { toast.error('Salve o formulário antes de escolher a IA.'); return; }
      if (await gravarIa(ref, chave, confirmar)) {
        toast.success('IA da campanha gravada');
        if (fechaAoGravar.current) { fechaAoGravar.current = false; aoFechar(); }
      }
    } catch (e) {
      toast.error(motivoEscrito(e) ?? 'Não consegui mudar a IA desta campanha.');
    } finally {
      setIaOcupada(false);
    }
  };

  const escolher = (chave: string) => {
    if (novo) { setPendente(chave); setAvisoDaIa(null); return; }
    void pedir(chave, false);
  };

  const tirar = async (d: IaDaCampanha) => {
    if (novo) { setPendente(null); return; }
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

  /** Depois do Criar: grava a IA escolhida. Devolve se a janela pode fechar. */
  const gravarIaDoCriar = async (ficha: LeadAdsFormConfig, chave: string): Promise<boolean> => {
    setPendente(null);
    try {
      if (await gravarIa({ kind: 'form', id: ficha.form_id }, chave, false)) return true;
      fechaAoGravar.current = true; // o 409: a pergunta de mover está na tela
      return false;
    } catch (e) {
      const motivo = motivoEscrito(e);
      setAvisoDaIa(`A ficha foi criada, mas a IA não foi gravada${motivo ? `: ${motivo}` : ''}. Escolha a IA de novo.`);
      toast.error('A ficha foi criada, mas a IA não foi gravada.');
      return false;
    }
  };

  // ---- Copiar de outra ficha ----
  // Só sugere: nada grava até o Criar. Não toca na identidade do formulário (form_id, nome, página), que fica com quem chama.
  const [copiou, setCopiou] = useState(false);
  const [avisoDaCopia, setAvisoDaCopia] = useState<string | null>(null);
  const esperaALista = listaCarregando && !listaFalhou;
  const parecida = novo && !copiou && fichas ? fichaParecida(nomeDoItem(item), fichas) : null;
  const copiarDe = (origem: LeadAdsFormConfig) => {
    const ori = itemDaFicha(origem, origem.form_name, itensDaLista?.find((i) => i.form_config_id === origem.id));
    const escopoDaOrigem = ori.sells_scope ?? (ori.property_ids.length ? 'properties' : null);
    if (escopoDaOrigem) {
      escopoImplicito.current = false;
      setEscopo(escopoDaOrigem);
      setIds(ori.property_ids.map(String));
      if (ori.sells_listing_kind) setTipoDeImovel(ori.sells_listing_kind);
    }
    setCond(condicaoEmEdicao(ori.offer_condition));
    setIntencoes(ori.audience_intents ?? []);
    if (temCondicao(ori.offer_condition) || (ori.audience_intents ?? []).length > 0) setOfertaAberta(true);
    aoCopiarEntrada?.(origem);
    // A IA: só a que está na lista desta campanha. A de regra mais ampla atende o formulário novo do mesmo jeito.
    // Nunca cala: sem a lista, sem o item da origem ou sem a opção, copia o resto e diz que a IA ficou de fora.
    const naoCopiou = (motivo: string) => setAvisoDaCopia(`A IA não foi copiada: ${motivo}. Escolha em Pôr numa IA, se quiser.`);
    const daLista = itensDaLista?.find((i) => i.form_config_id === origem.id);
    if (listaFalhou) naoCopiou('a lista de campanhas não carregou');
    else if (!opcoesDeIa) {
      // As opções da IA vêm de outra chamada: ainda chegando ou falhou. Só avisa se a origem tinha IA da campanha.
      if (ori.agents.some((a) => a.kind === 'campaign')) naoCopiou('as opções de IA não carregaram');
    } else {
      if (!daLista) naoCopiou('não achei a ficha de origem na lista de campanhas');
      else {
        const dela = ori.agents.find((a) => a.kind === 'campaign');
        if (dela) {
          const op = opcoes.find((o) => o.chave === chaveDaIa(dela.sales_agent_id, dela.sales_agent_number_id));
          if (op && !op.fixa) { setPendente(op.chave); setAvisoDaIa(null); setAvisoDaCopia(null); }
          else naoCopiou('a opção dela não está mais disponível');
        }
      }
    }
    setCopiou(true);
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
        const eraNovo = !configAtual;
        const salva = configAtual ? await leadAdsFormsService.update(configAtual.id, payload) : await leadAdsFormsService.create(payload);
        if (eraNovo || criada) setCriada(salva);
        toast.success(eraNovo ? 'Configuração salva' : 'Configuração atualizada');
        aoSalvar?.({ config: salva });
        if (eraNovo && pendente && !(await gravarIaDoCriar(salva, pendente))) return;
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

  const frase = fraseDaIntencao(intencoes, 'desta campanha');
  const linhasDeCondicao = condicaoDaLinha({ offer_condition: condicaoParaGravar(cond) }, umSo);
  const sugestao = normalizarNome(nomeDoItem(item)).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim() || null;
  const eForm = tipo === 'form';

  const imovelEmTexto = escopo === 'catalog' ? 'Todo o catálogo'
    : escopo === 'listing_kind' ? `Todo o tipo ${TIPOS_DE_IMOVEL[tipoDeImovel]}`
      : escopo === 'properties'
        ? (ids.length === 0 ? 'Nenhum imóvel escolhido' : umSo ? (umSo.title || umSo.code || 'Imóvel') : `${ids.length} ${ids.length === 1 ? 'imóvel' : 'imóveis'}`)
        : 'Sem imóvel';
  const resumo = [
    imovelEmTexto,
    eForm ? resumoDaEntrada : null,
    opcoesDeIa ? (donosNaTela.length ? donosNaTela.map((d) => d.name).join(', ') : 'Sem IA') : null,
  ].filter(Boolean).join(' · ');

  // Quem atende e a oferta saem em cada janela do mesmo jeito; o que muda é a esquerda.
  const oQueVende = (
    <GrupoDaJanela titulo={eForm ? 'O que esta campanha vende' : 'O que este anúncio oferece'}>
      <BotoesDeEscolha<EscopoDaOferta>
        rotulo="O que vende" semNome valor={escopoNaTela} desabilitado={!podeEditar}
        opcoes={[
          { valor: 'properties', rotulo: 'Imóveis escolhidos' },
          { valor: 'listing_kind', rotulo: 'Um tipo inteiro' },
          { valor: 'catalog', rotulo: 'Todo o catálogo' },
        ]}
        aoEscolher={escolheEscopo}
      />
      {escopoNaTela === 'properties' && (
        <CampoDaJanela rotulo="Imóveis" htmlFor="oferta_busca" ajuda={`De 1 a ${MAX_DE_IMOVEIS}. Marque na lista ou busque por título ou código.`}>
          <SeletorDeImoveis id="oferta_busca" selecionados={ids} max={MAX_DE_IMOVEIS} sugestaoQ={ids.length ? null : sugestao}
            disabled={!podeEditar} aoMudar={mudaImoveis} />
          {ids.length >= MAX_DE_IMOVEIS && <p className="text-sm text-muted-foreground">Chegou em {MAX_DE_IMOVEIS} imóveis, o máximo de uma campanha.</p>}
          {ids.length > 1 && (
            <p className="rounded-md bg-accent px-3 py-2 text-xs text-accent-foreground">
              Com mais de um, a conversa começa sem imóvel fixo: ela descobre qual serve e o escolhido vira o imóvel da conversa.
              {eForm ? ' O imóvel de interesse do card só nasce quando a pessoa escolhe.' : ''}
            </p>
          )}
          {semImovel && <p role="alert" className="text-xs text-destructive">Escolha pelo menos um imóvel.</p>}
        </CampoDaJanela>
      )}
      {escopo === 'listing_kind' && (
        <CampoDaJanela rotulo="Tipo" htmlFor="oferta_tipo" ajuda="Todos os imóveis daquele tipo. A busca da conversa fica só nele.">
          <Seletor id="oferta_tipo" value={tipoDeImovel} onChange={(e) => setTipoDeImovel(e.target.value as TipoDoImovel)}
            className="w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm">
            {(Object.keys(TIPOS_DE_IMOVEL) as TipoDoImovel[]).map((k) => <option key={k} value={k}>{TIPOS_DE_IMOVEL[k]}</option>)}
          </Seletor>
        </CampoDaJanela>
      )}
      {escopo === 'catalog' && <p className="text-sm text-muted-foreground">A IA não fixa imóvel: descobre o que a pessoa procura e busca no catálogo.</p>}
      {!escopo && ids.length === 0 && <p className="text-sm text-muted-foreground">Ainda não diz. A IA segue pelo imóvel principal dela, e a Saúde da IA avisa.</p>}
    </GrupoDaJanela>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) aoFechar(); }}>
      <DialogContent size="wide" className="flex flex-col overflow-hidden max-sm:h-dvh max-sm:max-h-none max-sm:rounded-none">
        <DialogHeader>
          <DialogTitle>{tipo === 'form' ? (configAtual ? 'Editar formulário do Meta' : 'Configurar formulário do Meta') : 'Editar anúncio de WhatsApp'}</DialogTitle>
          <DialogDescription>
            <strong>{nomeDoItem(item)}</strong>
            {item.campaign_name && item.kind === 'form' ? <> · Campanha {item.campaign_name}</> : null}
            {item.leads_count > 0 ? <> · {item.leads_count} {item.leads_count === 1 ? 'lead' : 'leads'} em 90 dias</> : null}
          </DialogDescription>
        </DialogHeader>

        {/* Só o miolo rola: a janela não (overflow-hidden), o topo e o rodapé ficam parados. A folga de 1 evita cortar o anel de foco.
            `relative` prende o texto sr-only ("(obrigatório)", absoluto) ao miolo: sem isso ele sai pra fora da rolagem, cai no fim da janela e a faz rolar. */}
        <div data-testid="miolo-da-janela" className="relative -mx-1 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1">
        {!podeEditar && (
          <Aviso tom="neutro" compacto>
            {!podeCriar
              ? 'Este anúncio ainda não tem linha em Campanhas, e criar a linha pede a permissão de criar campanha. Peça pro gerente ou administrador.'
              : 'Você pode ver esta campanha, mas não mudar. Quem edita é o gerente ou o administrador.'}
          </Aviso>
        )}

        <div className="grid min-w-0 grid-cols-1 gap-6 py-2 lg:grid-cols-[7fr_5fr]">
          <section aria-label={eForm ? 'Entrada do lead' : 'O que o anúncio oferece'} data-testid={eForm ? 'coluna-entrada' : 'coluna-oferece'} className="grid min-w-0 content-start gap-5">
            <fieldset disabled={!podeEditar || salvando} className="m-0 grid min-w-0 content-start gap-5 border-0 p-0">
              {eForm && item.keyword_rule && (
                <p data-testid="regra-por-nome" className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                  Nome contém <strong>{configAtual?.match_keyword || nomeDoItem(item)}</strong>
                </p>
              )}
              {parecida && (
                <Aviso tom="neutro" compacto>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 break-words">
                      Parece com a ficha <strong>{parecida.form_name}</strong>.
                      {esperaALista && <span className="block text-xs text-muted-foreground">Esperando a lista de campanhas chegar...</span>}
                    </p>
                    <Button type="button" variant="outline" size="sm" disabled={esperaALista} onClick={() => copiarDe(parecida)}>Copiar a configuração</Button>
                  </div>
                </Aviso>
              )}
              {avisoDaCopia && <Aviso tom="atencao" compacto>{avisoDaCopia}</Aviso>}
              {oQueVende}
              {eForm && entrada}
            </fieldset>
          </section>

          <section aria-label="Quem atende e oferta" data-testid="coluna-direita" className="grid min-w-0 content-start gap-5">
            {opcoesDeIa && (
              <GrupoDaJanela titulo="Quem atende">
                <QuemAtende donos={donosNaTela} opcoes={opcoesNaTela} podeMexer={podeEditar} novo={novo} aoEscolher={escolher} aoTirar={tirar}
                  ocupado={iaOcupada || salvando} movendo={movendo} aoMover={() => movendo && pedir(movendo.chave, true)}
                  aoDeixar={() => { setMovendo(null); fechaAoGravar.current = false; }} aviso={avisoDaIa} ficouSemIa={ficouSemIa} />
              </GrupoDaJanela>
            )}

            <fieldset disabled={!podeEditar || salvando} className="m-0 grid min-w-0 content-start gap-5 border-0 p-0">
              <GrupoDaJanela titulo={eForm ? 'Oferta do anúncio (opcional)' : 'Condição e pra quem é este anúncio'}>
                {!ofertaAberta ? (
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm text-muted-foreground">{fraseDoCadastro(escopo, ids.length, umSo)}</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setOfertaAberta(true)}>Personalizar a oferta</Button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">Só se for diferente da do imóvel. O que ficar vazio vem do cadastro do imóvel.</p>
                    {tipo === 'whats' && (
                      <div className="grid min-w-0 gap-1">
                        <div>
                          <Button type="button" variant="outline" size="sm" onClick={preencherComOAnuncio} disabled={!podeEditar || preenchendo || !textoDoAnuncio}
                            title={textoDoAnuncio ? undefined : 'Este anúncio não trouxe texto.'}>
                            {preenchendo ? 'Lendo o anúncio...' : 'Preencher com o texto do anúncio'}
                          </Button>
                        </div>
                        {textoDoAnuncio && <p className="line-clamp-2 min-w-0 break-words text-xs text-muted-foreground">Texto: {textoDoAnuncio}</p>}
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
                      <CampoDaJanela rotulo={eForm ? 'Observação do formulário' : 'Observação do anúncio'} htmlFor="cond_note" colunas={4}
                        ajuda={`${cond.note.length} de ${TETO_DA_OBSERVACAO}`}>
                        <textarea id="cond_note" value={cond.note} maxLength={TETO_DA_OBSERVACAO} rows={2}
                          onChange={(e) => mudaCond('note', e.target.value)}
                          placeholder="Ex.: imóveis de 30% a 70% abaixo da avaliação, a partir de R$ 115 mil"
                          className="w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm" />
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

                    <p className="pt-1 text-[13px] font-medium text-foreground/80">Pra quem é este anúncio (opcional)</p>
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
                  </>
                )}
              </GrupoDaJanela>
            </fieldset>
          </section>
        </div>
        </div>

        <DialogFooter>
          {podeApagar && (
            <Button type="button" variant="ghost" className="text-destructive sm:mr-2" onClick={aoApagar}>Excluir ficha</Button>
          )}
          <p data-testid="resumo-do-rodape" className="min-w-0 break-words text-xs text-muted-foreground max-sm:order-last sm:mr-auto sm:flex-1 sm:self-center">{resumo}</p>
          <Button variant="outline" onClick={aoFechar}>{podeEditar ? 'Cancelar' : 'Fechar'}</Button>
          {podeEditar && (
            <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : novo ? 'Criar' : 'Salvar'}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
