// O estado do Testar (movido do TelaTestar, entrega 3, sem mudar a regra): cada
// mensagem roda o MESMO turno do atendimento no servidor, numa conversa que só
// existe em memória. O estado vai e volta inteiro a cada passo — a tela não monta
// histórico (era o que fazia o Testar divergir). Nada sai no WhatsApp.
//
// 07/10/2026 (pedido do dono do produto): o lead do teste é quem está testando
// (sem campo de nome), os cenários são cartões prontos, o "Respeitar o gatilho"
// decide se o gatilho cala a IA, e as respostas dela chegam como no WhatsApp:
// três pontinhos, uma bolha de cada vez, tiques azuis na mensagem do lead.
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import {
  salesAgentsService, type RehearsalForm, type RehearsalOutcome, type RehearsalState, type SalesAgent, type TestHistoryItem,
} from '@/services/salesAgents/salesAgentsService';
import { CENARIOS_DO_TESTAR, type CenarioDeTeste } from '@/features/salesAgents/cenariosDeTeste';
import {
  AVISO_DO_GATILHO, GATILHO, horaCurta, itensDoEstado, itensDoTurno, tempoDeDigitacao, type ItemDaConversa,
} from '@/features/salesAgents/ensaio';

/** O lead do teste é quem está testando: ninguém precisa inventar um nome pra testar. */
export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? '').trim().split(/\s+/)[0] || 'Lead Teste';
}

/** Sem gatilho ela atende todo lead: o interruptor nem aparece. */
export function temGatilho(agent: SalesAgent): boolean {
  return (agent.triggers?.length ?? 0) > 0 || !!agent.trigger_keyword?.trim();
}

export function temGatilhoDeFormulario(agent: SalesAgent): boolean {
  return (agent.triggers ?? []).some((t) => t.type === 'form' && (t.form_ids?.length ?? 0) > 0);
}

/** O formulário que abre escolhido: o que recebeu lead por último; sem lead em nenhum, o primeiro. */
export function formularioPadrao(lista: RehearsalForm[]): RehearsalForm | null {
  const comLead = lista.filter((f) => f.last_lead_at).sort((a, b) => String(b.last_lead_at).localeCompare(String(a.last_lead_at)));
  return comLead[0] ?? lista[0] ?? null;
}

const FORM = 'form';
// Depois de quanto tempo os pontinhos aparecem, como no WhatsApp.
const RESPIRO_MS = 600;

type ItemDoLead = Extract<ItemDaConversa, { tipo: 'lead' }>;

/**
 * `ritmo` multiplica as esperas da animação (1 = normal). Os testes passam 0: a
 * ordem das bolhas é a mesma, só sem esperar.
 */
export function useEnsaio(agent: SalesAgent, ritmo = 1) {
  const nomeDeQuemTesta = primeiroNome(useAuthStore((s) => s.currentUser?.display_name || s.currentUser?.name));
  const comFormulario = temGatilhoDeFormulario(agent);
  const [ensaio, setEnsaio] = useState<RehearsalState | null>(null);
  const [itens, setItens] = useState<ItemDaConversa[]>([]);
  // O último turno com ficha: avançar o tempo não apaga o painel da direita.
  const [ficha, setFicha] = useState<RehearsalOutcome | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [digitando, setDigitando] = useState(false);
  const [semente, setSemente] = useState<{ history: TestHistoryItem[]; hours_ago?: number } | null>(null);
  const [nome, setNome] = useState(nomeDeQuemTesta);
  const [origem, setOrigem] = useState('');
  const [interesse, setInteresse] = useState('');
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [adReferral, setAdReferral] = useState<Record<string, string> | null>(null);
  const [imovel, setImovel] = useState('');
  const [telefone, setTelefone] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [cenario, setCenario] = useState('');
  const [respeitarGatilho, setRespeitarGatilho] = useState(false);
  const [formularios, setFormularios] = useState<RehearsalForm[] | null>(null);
  const [formulario, setFormulario] = useState('');
  const [lendoFormularios, setLendoFormularios] = useState(false);
  const fimDoChat = useRef<HTMLDivElement>(null);
  const cenarioAtual = useRef('');
  // O aviso "no atendimento ela não entraria" sai uma vez por teste, não a cada turno.
  const avisouGatilho = useRef(false);
  const rolar = () => setTimeout(() => fimDoChat.current?.scrollIntoView?.({ block: 'end' }), 0);
  const espera = (ms: number) => new Promise<void>((r) => { setTimeout(r, ms * ritmo); });
  // ⚠️ A resposta de um turno pode voltar com a janela já fechada: aí não grita
  // (toast de erro ou "Conversa carregada" de uma janela que ninguém vê mais).
  const aberta = useRef(true);
  useEffect(() => {
    aberta.current = true;
    return () => { aberta.current = false; };
  }, []);
  const avisarErro = (e: unknown) => { if (aberta.current) toast.error((e as Error).message); };

  // Uma bolha de cada vez: os pontinhos, a bolha, um respiro. Sistema e mídia
  // entram direto, na ordem em que vieram.
  const revelar = async (novos: ItemDaConversa[]) => {
    let primeira = true;
    for (const it of novos) {
      if (!aberta.current) return;
      if (it.tipo === 'ia') {
        setDigitando(true);
        rolar();
        // A primeira já esperou o servidor com os pontinhos na tela.
        await espera(primeira ? 300 : tempoDeDigitacao(it.texto, it.pausa));
        primeira = false;
        if (!aberta.current) return;
        setDigitando(false);
      }
      setItens((prev) => [...prev, it]);
      rolar();
      if (it.tipo === 'ia') await espera(150);
    }
  };

  // Os tiques da última mensagem do lead: hora do relógio do teste, e azul só se ela respondeu.
  const marcarLead = (estado: RehearsalState, respondeu: boolean) => {
    const ultima = [...estado.messages].reverse().find((m) => m.role === 'user');
    setItens((prev) => {
      const i = prev.map((it) => it.tipo).lastIndexOf('lead');
      if (i < 0) return prev;
      const copia = [...prev];
      copia[i] = { ...(copia[i] as ItemDoLead), hora: horaCurta(ultima?.at), lida: respondeu };
      return copia;
    });
  };

  const avisoDoGatilho = (o: RehearsalOutcome | null | undefined): ItemDaConversa[] => {
    if (avisouGatilho.current || !o?.warnings.some((w) => w.reason === GATILHO)) return [];
    avisouGatilho.current = true;
    return [{ tipo: 'sistema', texto: AVISO_DO_GATILHO }];
  };

  const enviar = async () => {
    const texto = mensagem.trim();
    if (!texto || ocupado) return;
    const codigo = imovel.trim();
    setMensagem('');
    setOcupado(true);
    setItens((prev) => [...prev, { tipo: 'lead', texto }]);
    rolar();
    const pontinhos = setTimeout(() => { if (aberta.current) setDigitando(true); }, RESPIRO_MS * ritmo);
    try {
      const r = await salesAgentsService.rehearsal(agent.id, {
        step: 'turn', state: ensaio, message: texto, honor_triggers: respeitarGatilho,
        context: {
          contact_name: nome.trim() || nomeDeQuemTesta, source: origem.trim(), interest: interesse.trim(),
          form_answers: respostas, property_code: codigo, ...(adReferral ? { ad_referral: adReferral } : {}),
        },
        ...(!ensaio && semente ? { seed: semente } : {}),
      });
      clearTimeout(pontinhos);
      setEnsaio(r.state);
      if (r.turn.outcome) setFicha(r.turn.outcome);
      setSemente(null);
      marcarLead(r.state, r.turn.kind === 'reply');
      setDigitando(false);
      await revelar([...avisoDoGatilho(r.turn.outcome), ...itensDoTurno(r.turn, codigo)]);
    } catch (e) {
      // A mensagem não entrou no teste: tira a bolha e devolve o texto pro campo,
      // senão quem tenta de novo vê duas mensagens e o servidor tem uma.
      clearTimeout(pontinhos);
      setItens((prev) => prev.slice(0, -1));
      setMensagem(texto);
      avisarErro(e);
    } finally {
      setDigitando(false);
      setOcupado(false);
    }
  };

  const avancar = async (horas: number | null) => {
    if (!ensaio || ocupado) return;
    setOcupado(true);
    try {
      const r = await salesAgentsService.rehearsal(agent.id, { step: 'advance', state: ensaio, hours: horas, honor_triggers: respeitarGatilho });
      setEnsaio(r.state);
      await revelar(itensDoTurno(r.turn, imovel.trim()));
    } catch (e) {
      avisarErro(e);
    } finally {
      setDigitando(false);
      setOcupado(false);
    }
  };

  const carregar = async () => {
    // Com um turno no ar, a resposta atrasada misturaria as duas conversas.
    if (ocupado || carregando) return;
    const fone = telefone.replace(/\D/g, '');
    if (fone.length < 10) { toast.error('Digite o telefone com DDD.'); return; }
    setCarregando(true);
    try {
      const r = await salesAgentsService.rehearsal(agent.id, { step: 'load', phone: fone });
      setEnsaio(r.state);
      setFicha(r.turn.outcome);
      setSemente(null);
      setCenario('');
      cenarioAtual.current = '';
      avisouGatilho.current = false;
      setItens(itensDoEstado(r.state));
      // A conversa é de um lead de verdade: o nome e as respostas são dele.
      setNome(r.state.contact.name ?? nomeDeQuemTesta);
      setRespostas(r.state.contact.form_answers ?? {});
      setAdReferral(null);
      setOrigem(String(r.state.attrs.source ?? ''));
      setInteresse(String(r.state.attrs.initial_interest ?? ''));
      // ⚠️ O imóvel do lead vem junto: vazio, o próximo turno apagaria o imóvel que o lead real tem.
      setImovel(String(r.state.attrs.sales_agent_property_code ?? ''));
      if (aberta.current) toast.success(`Conversa carregada: ${r.state.messages.length} mensagens`);
    } catch (e) {
      avisarErro(e);
    } finally {
      setCarregando(false);
    }
  };

  // Aplicar um cenário SUBSTITUI o teste: o histórico decide se a IA abre do zero
  // ou continua de onde parou, e misturar criaria uma conversa que não existe.
  // `c` nulo = Conversa livre. `form` = o formulário de verdade (cenário "form").
  const aplicar = (c: CenarioDeTeste | null, form: RehearsalForm | null = null) => {
    setCenario(c?.id ?? '');
    cenarioAtual.current = c?.id ?? '';
    avisouGatilho.current = false;
    setNome(nomeDeQuemTesta);
    setOrigem(c?.source ?? '');
    setInteresse(c?.interest ?? '');
    const reais = form && form.origin !== 'none' && Object.keys(form.answers).length > 0 ? form.answers : null;
    setRespostas(reais ?? c?.formAnswers ?? {});
    setAdReferral(form?.ad_referral ?? null);
    setMensagem(c?.firstMessage ?? '');
    setEnsaio(null);
    setFicha(null);
    setSemente(c?.history?.length ? { history: c.history, hours_ago: c.historyHoursAgo } : null);
    setItens((c?.history ?? []).map((m) => (
      m.role === 'user' ? { tipo: 'lead' as const, texto: m.content, lida: true } : { tipo: 'ia' as const, texto: m.content, pausa: 0 }
    )));
  };

  // "Preencheu o formulário" numa IA com gatilho de formulário: lê os formulários
  // uma vez (só ao escolher o cenário) e abre no que recebeu lead por último.
  const escolherCenario = async (id: string) => {
    if (ocupado || carregando) return;
    const c = CENARIOS_DO_TESTAR.find((x) => x.id === id) ?? null;
    if (c?.id !== FORM || !comFormulario) { aplicar(c); return; }
    let lista = formularios;
    if (lista === null) {
      aplicar(c);
      setLendoFormularios(true);
      try {
        lista = await salesAgentsService.rehearsalForms(agent.id);
      } catch (e) {
        lista = [];
        avisarErro(e);
      } finally {
        setLendoFormularios(false);
      }
      setFormularios(lista);
      // Trocou de cenário enquanto lia: não volta pro formulário.
      if (cenarioAtual.current !== FORM) return;
    }
    const f = lista.find((x) => x.form_id === formulario) ?? formularioPadrao(lista);
    setFormulario(f?.form_id ?? '');
    aplicar(c, f);
  };

  // Trocar de formulário recomeça o teste com as respostas dele.
  const escolherFormulario = (formId: string) => {
    if (ocupado || carregando) return;
    const f = (formularios ?? []).find((x) => x.form_id === formId) ?? null;
    setFormulario(formId);
    aplicar(CENARIOS_DO_TESTAR.find((x) => x.id === FORM) ?? null, f);
  };

  // ⚠️ Com um cenário escolhido, Recomeçar recomeça O MESMO cenário (histórico,
  // semente, primeira mensagem e formulário). Só zerar a conversa deixava a frase
  // do cenário na tela, e o próximo turno rodava como conversa livre.
  const recomecar = () => {
    if (ocupado || carregando) return;
    const c = CENARIOS_DO_TESTAR.find((x) => x.id === cenario) ?? null;
    const f = c?.id === FORM ? (formularios ?? []).find((x) => x.form_id === formulario) ?? null : null;
    aplicar(c, f);
  };

  const formularioAtual = (formularios ?? []).find((x) => x.form_id === formulario) ?? null;

  return {
    ensaio, itens, ficha, mensagem, setMensagem, ocupado, digitando, nome, origem, respostas,
    imovel, setImovel, telefone, setTelefone, carregando, cenario, fimDoChat,
    respeitarGatilho, setRespeitarGatilho, comFormulario, formularios, formularioAtual, lendoFormularios,
    enviar, avancar, carregar, escolherCenario, escolherFormulario, recomecar,
  };
}
