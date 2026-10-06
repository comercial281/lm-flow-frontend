import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Bot, Loader2, RotateCcw, Send, SlidersHorizontal, FastForward, Zap } from 'lucide-react';
import { Button, Input, Label, Textarea } from '@/components/ui/ds';
import TestMediaBubble from '../TestMediaBubble';
import { Seletor } from '@/components/base/Seletor';
import { usePergunta } from '@/hooks/usePergunta';
import {
  salesAgentsService,
  type RehearsalState,
  type RehearsalTurn,
  type SalesAgent,
  type TestHistoryItem,
} from '@/services/salesAgents/salesAgentsService';
import { CENARIOS_DE_TESTE, type CenarioDeTeste } from '@/features/salesAgents/cenariosDeTeste';
import {
  OPCOES_DE_AVANCO, avisoDoModelo, itensDoEstado, itensDoTurno, linhasDoQueAconteceria, pausa,
  respostasDoFormulario, textoDasRespostas, type ItemDaConversa,
} from '@/features/salesAgents/ensaio';

// Cenários que o próprio usuário salva. localStorage: é ferramenta de bancada,
// não dado de produção. Mesma chave do Testar antigo (os salvos continuam).
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
  try {
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify(lista));
  } catch {
    // Cota cheia ou storage bloqueado: o cenário se perde, o teste continua.
  }
}

/**
 * Testar fiel (entrega 3). Cada mensagem roda o MESMO turno do atendimento no
 * servidor, numa conversa que só existe em memória: nada sai no WhatsApp e nada
 * é gravado. O estado do teste mora aqui e vai e volta inteiro a cada passo.
 */
export function TelaTestar({ agent }: { agent: SalesAgent }) {
  const { perguntar, dialogoDePergunta } = usePergunta();
  const [ensaio, setEnsaio] = useState<RehearsalState | null>(null);
  const [itens, setItens] = useState<ItemDaConversa[]>([]);
  const [ultimo, setUltimo] = useState<RehearsalTurn | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [avanco, setAvanco] = useState(0);
  const [semente, setSemente] = useState<{ history: TestHistoryItem[]; hours_ago?: number } | null>(null);
  const [nome, setNome] = useState('Lead Teste');
  const [origem, setOrigem] = useState('');
  const [interesse, setInteresse] = useState('');
  const [respostas, setRespostas] = useState('');
  const [imovel, setImovel] = useState('');
  const [telefone, setTelefone] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [salvos, setSalvos] = useState<CenarioDeTeste[]>(() => lerSalvos());
  const [ajustarAberto, setAjustarAberto] = useState(false);
  const fimDoChat = useRef<HTMLDivElement>(null);

  const rolar = () => setTimeout(() => fimDoChat.current?.scrollIntoView?.({ block: 'end' }), 0);

  const enviar = async () => {
    const texto = mensagem.trim();
    if (!texto || ocupado) return;
    const codigo = imovel.trim();
    setMensagem('');
    setOcupado(true);
    setItens((prev) => [...prev, { tipo: 'lead', texto }]);
    try {
      const r = await salesAgentsService.rehearsal(agent.id, {
        step: 'turn',
        state: ensaio,
        message: texto,
        context: {
          contact_name: nome.trim() || 'Lead Teste',
          source: origem.trim(),
          interest: interesse.trim(),
          form_answers: respostasDoFormulario(respostas),
          property_code: codigo,
        },
        ...(!ensaio && semente ? { seed: semente } : {}),
      });
      setEnsaio(r.state);
      setUltimo(r.turn);
      setSemente(null);
      setItens((prev) => [...prev, ...itensDoTurno(r.turn, codigo)]);
      rolar();
    } catch (e) {
      // A mensagem não entrou no teste: tira a bolha e devolve o texto pro campo,
      // senão quem tenta de novo vê duas mensagens e o servidor tem uma.
      setItens((prev) => prev.slice(0, -1));
      setMensagem(texto);
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const avancar = async () => {
    if (!ensaio || ocupado) return;
    setOcupado(true);
    try {
      const r = await salesAgentsService.rehearsal(agent.id, {
        step: 'advance', state: ensaio, hours: OPCOES_DE_AVANCO[avanco].horas,
      });
      setEnsaio(r.state);
      // "O que aconteceria" era do turno anterior: avançar o tempo não o repete.
      setUltimo(null);
      setItens((prev) => [...prev, ...itensDoTurno(r.turn, imovel.trim())]);
      rolar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const carregar = async () => {
    // Com um turno no ar, a resposta atrasada misturaria as duas conversas.
    if (ocupado || carregando) return;
    const fone = telefone.replace(/\D/g, '');
    if (fone.length < 10) {
      toast.error('Digite o telefone com DDD.');
      return;
    }
    setCarregando(true);
    try {
      const r = await salesAgentsService.rehearsal(agent.id, { step: 'load', phone: fone });
      setEnsaio(r.state);
      setUltimo(r.turn);
      setSemente(null);
      setItens(itensDoEstado(r.state));
      setNome(r.state.contact.name ?? 'Lead Teste');
      setRespostas(textoDasRespostas(r.state.contact.form_answers ?? {}));
      setOrigem(String(r.state.attrs.source ?? ''));
      setInteresse(String(r.state.attrs.initial_interest ?? ''));
      // ⚠️ O imóvel do lead vem junto: com o campo vazio, a próxima mensagem mandaria
      // property_code '' e o teste apagaria o imóvel que o lead real tem.
      setImovel(String(r.state.attrs.sales_agent_property_code ?? ''));
      toast.success(`Conversa carregada: ${r.state.messages.length} mensagens`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCarregando(false);
    }
  };

  // Aplicar um cenário SUBSTITUI o teste: o histórico decide se a IA abre do zero
  // ou continua de onde parou, e misturar criaria uma conversa que não existe.
  const aplicarCenario = (c: CenarioDeTeste) => {
    if (ocupado || carregando) return;
    setNome(c.contactName);
    setOrigem(c.source);
    setInteresse(c.interest);
    setRespostas(textoDasRespostas(c.formAnswers));
    setMensagem(c.firstMessage);
    setEnsaio(null);
    setUltimo(null);
    setSemente(c.history?.length ? { history: c.history, hours_ago: c.historyHoursAgo } : null);
    setItens((c.history ?? []).map((m) => (
      m.role === 'user' ? { tipo: 'lead' as const, texto: m.content } : { tipo: 'ia' as const, texto: m.content, pausa: 0 }
    )));
  };

  const recomecar = () => {
    setEnsaio(null);
    setUltimo(null);
    setSemente(null);
    setItens([]);
  };

  const salvarCenario = async () => {
    const label = await perguntar({
      titulo: 'Salvar este cenário',
      descricao: 'A conversa da tela vira o histórico do cenário, pra você repetir este caso depois.',
      rotuloDoCampo: 'Nome do cenário',
      placeholder: 'Ex.: lead frio que some no meio',
      rotuloDaAcao: 'Salvar cenário',
    });
    if (!label) return;
    const historia: TestHistoryItem[] = ensaio
      ? ensaio.messages.map(({ role, content }) => ({ role, content }))
      : (semente?.history ?? []);
    const novo: CenarioDeTeste = {
      id: `custom-${label.toLowerCase().replace(/\s+/g, '-')}`,
      label,
      subtitulo: 'Cenário salvo por você.',
      contactName: nome,
      source: origem,
      interest: interesse,
      formAnswers: respostasDoFormulario(respostas),
      history: historia,
      firstMessage: mensagem.trim(),
    };
    const lista = [...salvos.filter((s) => s.id !== novo.id), novo];
    setSalvos(lista);
    gravarSalvos(lista);
    toast.success(`Cenário "${label}" salvo`);
  };

  const removerCenario = (id: string) => {
    const lista = salvos.filter((s) => s.id !== id);
    setSalvos(lista);
    gravarSalvos(lista);
  };

  const linhas = linhasDoQueAconteceria(ultimo?.outcome);
  const modelo = avisoDoModelo(ultimo?.outcome?.test_model ?? agent.test_model, agent.model);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Testar</h2>
        <p className="text-sm text-muted-foreground">
          Converse como se fosse o lead. Nada é enviado no WhatsApp e nada é gravado.
        </p>
        {modelo.selo && (
          <p className="mt-1 text-xs">
            <span className="rounded-full border border-sidebar-border px-2 py-0.5">{modelo.selo}</span>
            {modelo.nota && <span className="ml-2 text-muted-foreground">{modelo.nota}</span>}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-3">
          <section className="border border-sidebar-border rounded-md p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium"><Zap className="h-4 w-4" /> Cenários</div>
            <div className="space-y-1.5">
              {[...CENARIOS_DE_TESTE, ...salvos].map((c) => (
                <div key={c.id} className="flex items-start gap-1">
                  <button
                    type="button"
                    onClick={() => aplicarCenario(c)}
                    className="flex-1 text-left rounded-md border border-sidebar-border px-2.5 py-1.5 hover:bg-muted transition-colors"
                  >
                    <span className="block text-xs font-medium">{c.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{c.subtitulo}</span>
                  </button>
                  {c.id.startsWith('custom-') && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => removerCenario(c.id)}>
                      Remover
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => void salvarCenario()}>
              Salvar este cenário
            </Button>
          </section>

          <section className="border border-sidebar-border rounded-md p-3 space-y-2">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-sm font-medium"
              onClick={() => setAjustarAberto((v) => !v)}
              aria-expanded={ajustarAberto}
            >
              <SlidersHorizontal className="h-4 w-4" /> Ajustar o teste
            </button>
            {ajustarAberto && (
              <div className="space-y-2">
                <div>
                  <Label htmlFor="ensaio_nome" className="text-xs">Nome do lead</Label>
                  <Input id="ensaio_nome" value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="ensaio_origem" className="text-xs">De onde veio</Label>
                  <Input id="ensaio_origem" placeholder="Anúncio Instagram — Vivaz Mooca" value={origem} onChange={(e) => setOrigem(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="ensaio_interesse" className="text-xs">Interesse inicial</Label>
                  <Input id="ensaio_interesse" placeholder="2 quartos até 400 mil" value={interesse} onChange={(e) => setInteresse(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="ensaio_respostas" className="text-xs">Respostas do formulário (uma por linha)</Label>
                  <Textarea id="ensaio_respostas" rows={3} placeholder="Faixa de investimento: até 450 mil" value={respostas} onChange={(e) => setRespostas(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="ensaio_imovel" className="text-xs">Imóvel</Label>
                  <Input id="ensaio_imovel" placeholder="Código do imóvel (ex: AP123)" value={imovel} onChange={(e) => setImovel(e.target.value)} />
                </div>
              </div>
            )}
          </section>

          <section className="border border-sidebar-border rounded-md p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium"><Bot className="h-4 w-4" /> Carregar uma conversa real</div>
            <div className="flex gap-2">
              <Input
                placeholder="Telefone com DDD"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void carregar(); }}
              />
              <Button variant="outline" onClick={() => void carregar()} disabled={carregando || !telefone.trim()}>
                {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Carregar'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Traz a conversa, a ficha e a abertura. Só lê: pode ser um lead ativo.</p>
          </section>
        </aside>

        <main className="space-y-3">
          <div className="border border-sidebar-border rounded-md p-3 h-[28rem] overflow-auto space-y-2 bg-muted/20">
            {itens.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Mande uma mensagem pra ver a IA responder.</p>
            ) : (
              itens.map((it, i) => {
                if (it.tipo === 'sistema') {
                  return <p key={i} className="text-center text-[11px] text-muted-foreground">{it.texto}</p>;
                }
                if (it.tipo === 'midia') {
                  return (
                    <div key={i} className="flex justify-end">
                      <TestMediaBubble
                        item={it.item}
                        onSendToMe={(item, phone) => salesAgentsService.testSend(agent.id, {
                          // O imóvel do TURNO que gerou esta bolha, não o do campo agora.
                          phone, token: item.token, property_code: it.propertyCode || undefined,
                        }).then((r) => r.message)}
                      />
                    </div>
                  );
                }
                const lead = it.tipo === 'lead';
                return (
                  <div key={i} className={`flex flex-col ${lead ? 'items-start' : 'items-end'}`}>
                    {!lead && it.pausa > 0 && <span className="text-[10px] text-muted-foreground">{pausa(it.pausa)}</span>}
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${lead ? 'bg-background border' : 'bg-primary/10 text-foreground'}`}>
                      {!lead && it.audio ? '🎤 áudio: ' : ''}{it.texto}
                    </div>
                  </div>
                );
              })
            )}
            {ocupado && <div className="flex justify-end"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
            <div ref={fimDoChat} />
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Mensagem do lead..."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void enviar(); }}
            />
            <Button onClick={() => void enviar()} disabled={ocupado || !mensagem.trim()}>
              <Send className="h-4 w-4 mr-1" /> Enviar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="ensaio_avanco" className="text-xs">Quanto avançar</Label>
            <Seletor
              id="ensaio_avanco"
              aria-label="Quanto avançar"
              className="h-9 rounded-md border border-sidebar-border bg-background px-2 text-sm"
              value={String(avanco)}
              onChange={(e) => setAvanco(Number(e.target.value))}
            >
              {OPCOES_DE_AVANCO.map((o, i) => <option key={o.rotulo} value={i}>{o.rotulo}</option>)}
            </Seletor>
            <Button variant="outline" onClick={() => void avancar()} disabled={ocupado || !ensaio}>
              <FastForward className="h-4 w-4 mr-1" /> Avançar o tempo
            </Button>
            <Button variant="ghost" onClick={recomecar} disabled={ocupado}>
              <RotateCcw className="h-4 w-4 mr-1" /> Recomeçar
            </Button>
          </div>

          {linhas.length > 0 && (
            <section className="border border-sidebar-border rounded-md p-3 space-y-1">
              <h3 className="text-sm font-medium">O que aconteceria</h3>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {linhas.map((l) => <li key={l}>{l}</li>)}
              </ul>
            </section>
          )}
        </main>
      </div>

      {dialogoDePergunta}
    </div>
  );
}
export default TelaTestar;
