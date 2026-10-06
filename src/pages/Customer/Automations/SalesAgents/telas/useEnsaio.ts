// O estado do Testar (movido do TelaTestar, entrega 3, sem mudar a regra): cada
// mensagem roda o MESMO turno do atendimento no servidor, numa conversa que só
// existe em memória. O estado vai e volta inteiro a cada passo — a tela não monta
// histórico (era o que fazia o Testar divergir). Nada sai no WhatsApp.
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { usePergunta } from '@/hooks/usePergunta';
import {
  salesAgentsService, type RehearsalOutcome, type RehearsalState, type SalesAgent, type TestHistoryItem,
} from '@/services/salesAgents/salesAgentsService';
import { CENARIOS_DE_TESTE, type CenarioDeTeste } from '@/features/salesAgents/cenariosDeTeste';
import { itensDoEstado, itensDoTurno, respostasDoFormulario, textoDasRespostas, type ItemDaConversa } from '@/features/salesAgents/ensaio';

// Cenários que o próprio usuário salva. localStorage: é ferramenta de bancada, não
// dado de produção. Mesma chave do Testar de antes: os salvos continuam.
const SCENARIOS_KEY = 'lmflow:sales-agent-test-scenarios';
function lerSalvos(): CenarioDeTeste[] {
  try {
    const raw = localStorage.getItem(SCENARIOS_KEY);
    const lista = raw ? (JSON.parse(raw) as Array<CenarioDeTeste & { hint?: string }>) : [];
    return lista.map((c) => ({ ...c, subtitulo: c.subtitulo ?? c.hint ?? 'Cenário salvo por você.' }));
  } catch {
    return [];
  }
}
function gravarSalvos(lista: CenarioDeTeste[]) {
  try { localStorage.setItem(SCENARIOS_KEY, JSON.stringify(lista)); } catch { /* storage bloqueado: o teste continua */ }
}

export function useEnsaio(agent: SalesAgent) {
  const { perguntar, dialogoDePergunta } = usePergunta();
  const [ensaio, setEnsaio] = useState<RehearsalState | null>(null);
  const [itens, setItens] = useState<ItemDaConversa[]>([]);
  // O último turno com ficha: avançar o tempo não apaga o painel da direita.
  const [ficha, setFicha] = useState<RehearsalOutcome | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [semente, setSemente] = useState<{ history: TestHistoryItem[]; hours_ago?: number } | null>(null);
  const [nome, setNome] = useState('Lead Teste');
  const [origem, setOrigem] = useState('');
  const [interesse, setInteresse] = useState('');
  const [respostas, setRespostas] = useState('');
  const [imovel, setImovel] = useState('');
  const [telefone, setTelefone] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [salvos, setSalvos] = useState<CenarioDeTeste[]>(() => lerSalvos());
  const [cenario, setCenario] = useState<string>('');
  const fimDoChat = useRef<HTMLDivElement>(null);
  const rolar = () => setTimeout(() => fimDoChat.current?.scrollIntoView?.({ block: 'end' }), 0);
  // ⚠️ A resposta de um turno pode voltar com a janela já fechada: aí não grita
  // (toast de erro ou "Conversa carregada" de uma janela que ninguém vê mais).
  const aberta = useRef(true);
  useEffect(() => {
    aberta.current = true;
    return () => { aberta.current = false; };
  }, []);
  const avisarErro = (e: unknown) => { if (aberta.current) toast.error((e as Error).message); };

  const enviar = async () => {
    const texto = mensagem.trim();
    if (!texto || ocupado) return;
    const codigo = imovel.trim();
    setMensagem('');
    setOcupado(true);
    setItens((prev) => [...prev, { tipo: 'lead', texto }]);
    try {
      const r = await salesAgentsService.rehearsal(agent.id, {
        step: 'turn', state: ensaio, message: texto,
        context: { contact_name: nome.trim() || 'Lead Teste', source: origem.trim(), interest: interesse.trim(), form_answers: respostasDoFormulario(respostas), property_code: codigo },
        ...(!ensaio && semente ? { seed: semente } : {}),
      });
      setEnsaio(r.state);
      if (r.turn.outcome) setFicha(r.turn.outcome);
      setSemente(null);
      setItens((prev) => [...prev, ...itensDoTurno(r.turn, codigo)]);
      rolar();
    } catch (e) {
      // A mensagem não entrou no teste: tira a bolha e devolve o texto pro campo,
      // senão quem tenta de novo vê duas mensagens e o servidor tem uma.
      setItens((prev) => prev.slice(0, -1));
      setMensagem(texto);
      avisarErro(e);
    } finally {
      setOcupado(false);
    }
  };

  const avancar = async (horas: number | null) => {
    if (!ensaio || ocupado) return;
    setOcupado(true);
    try {
      const r = await salesAgentsService.rehearsal(agent.id, { step: 'advance', state: ensaio, hours: horas });
      setEnsaio(r.state);
      setItens((prev) => [...prev, ...itensDoTurno(r.turn, imovel.trim())]);
      rolar();
    } catch (e) {
      avisarErro(e);
    } finally {
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
      setItens(itensDoEstado(r.state));
      setNome(r.state.contact.name ?? 'Lead Teste');
      setRespostas(textoDasRespostas(r.state.contact.form_answers ?? {}));
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
  const aplicarCenario = (c: CenarioDeTeste) => {
    if (ocupado || carregando) return;
    setCenario(c.id);
    setNome(c.contactName);
    setOrigem(c.source);
    setInteresse(c.interest);
    setRespostas(textoDasRespostas(c.formAnswers));
    setMensagem(c.firstMessage);
    setEnsaio(null);
    setFicha(null);
    setSemente(c.history?.length ? { history: c.history, hours_ago: c.historyHoursAgo } : null);
    setItens((c.history ?? []).map((m) => (m.role === 'user' ? { tipo: 'lead' as const, texto: m.content } : { tipo: 'ia' as const, texto: m.content, pausa: 0 })));
  };

  // ⚠️ Com um cenário escolhido, Recomeçar recomeça O MESMO cenário (histórico,
  // semente e primeira mensagem). Só zerar a conversa deixava o nome e a frase do
  // cenário na tela, e o próximo turno rodava como conversa livre.
  const recomecar = () => {
    const atual = [...CENARIOS_DE_TESTE, ...salvos].find((c) => c.id === cenario);
    if (atual) { aplicarCenario(atual); return; }
    setCenario('');
    setEnsaio(null);
    setFicha(null);
    setSemente(null);
    setItens([]);
  };

  const salvarCenario = async () => {
    const label = await perguntar({
      titulo: 'Salvar este cenário', descricao: 'A conversa da tela vira o histórico do cenário, pra você repetir este caso depois.',
      rotuloDoCampo: 'Nome do cenário', placeholder: 'Ex.: lead frio que some no meio', rotuloDaAcao: 'Salvar cenário',
    });
    if (!label) return;
    const historia: TestHistoryItem[] = ensaio ? ensaio.messages.map(({ role, content }) => ({ role, content })) : (semente?.history ?? []);
    const novo: CenarioDeTeste = {
      id: `custom-${label.toLowerCase().replace(/\s+/g, '-')}`, label, subtitulo: 'Cenário salvo por você.',
      contactName: nome, source: origem, interest: interesse, formAnswers: respostasDoFormulario(respostas), history: historia, firstMessage: mensagem.trim(),
    };
    const lista = [...salvos.filter((s) => s.id !== novo.id), novo];
    setSalvos(lista);
    gravarSalvos(lista);
    if (aberta.current) toast.success(`Cenário "${label}" salvo`);
  };

  // Só os salvos pelo usuário (id "custom-…") saem; os prontos ficam.
  const removerCenario = (id: string) => {
    if (!id.startsWith('custom-')) return;
    const lista = salvos.filter((s) => s.id !== id);
    setSalvos(lista);
    gravarSalvos(lista);
    if (cenario === id) setCenario('');
  };

  return {
    ensaio, itens, ficha, mensagem, setMensagem, ocupado, nome, setNome, origem, setOrigem, respostas, setRespostas,
    imovel, setImovel, telefone, setTelefone, carregando, salvos, cenario, fimDoChat,
    enviar, avancar, carregar, aplicarCenario, recomecar, salvarCenario, removerCenario, dialogoDePergunta,
  };
}
