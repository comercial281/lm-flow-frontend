import { useState } from 'react';
import { Button, Input, Label } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Bot, Plus, Send, Loader2, Link2, Copy, Check, SlidersHorizontal, Zap } from 'lucide-react';
import TestMediaBubble from '../TestMediaBubble';
import { salesAgentsService, type SalesAgent, type SalesAgentTestResult, type SalesAgentPropertyLink, type TestHistoryItem, type TestMediaItem } from '@/services/salesAgents/salesAgentsService';
import { usePergunta } from '@/hooks/usePergunta';

const TEMP_LABEL: Record<string, string> = {
  hot: 'Quente', warm: 'Morno', cold: 'Frio', unknown: 'Indefinido',
};

// ---------------- Link de anúncio (por imóvel) ----------------

function PropertyLinkBox({
  agent, propertyCode, onCodeChange,
}: {
  agent: SalesAgent;
  propertyCode: string;
  onCodeChange: (v: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SalesAgentPropertyLink | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const r = await salesAgentsService.propertyLink(agent.id, propertyCode.trim() || undefined);
      setResult(r);
    } catch {
      toast.error('Não foi possível gerar o link. Confira se o canal de WhatsApp está conectado no agente.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result?.link) return;
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success('Link copiado');
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  return (
    <div className="border border-sidebar-border rounded-md p-4 space-y-3 bg-muted/10">
      <div className="flex items-center gap-2 text-sm font-medium"><Link2 className="h-4 w-4" /> Link de anúncio com IA</div>
      <p className="text-xs text-muted-foreground">
        Cole este link no anúncio (Facebook, Google, YouTube) ou na landing do imóvel. O lead clica, cai no WhatsApp com
        a mensagem pronta e a IA já sabe de qual imóvel ele veio.
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="Código do imóvel (ex: AP123)"
          value={propertyCode}
          onChange={(e) => onCodeChange(e.target.value)}
        />
        <Button size="sm" onClick={generate} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerar link'}
        </Button>
      </div>
      {result?.link && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input readOnly value={result.link} className="text-xs" />
            <Button size="sm" variant="outline" onClick={copy} aria-label="Copiar link" title="Copiar link">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Mensagem pré-pronta: <span className="italic">"{result.message}"</span>
            {result.property && <> — imóvel <strong>{result.property.code}</strong> ({result.property.title})</>}
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        O mesmo código digitado aqui também é usado no teste abaixo, pra você ver a IA falando desse imóvel.
      </p>
    </div>
  );
}

// Par chave/valor do formulário do Meta. Estado local pra os dois campos não
// remontarem a lista inteira a cada tecla.
function FormAnswerAdder({ onAdd }: { onAdd: (key: string, value: string) => void }) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');

  const add = () => {
    if (!key.trim() || !value.trim()) return;
    onAdd(key.trim(), value.trim());
    setKey('');
    setValue('');
  };

  return (
    <div className="flex gap-2">
      <Input placeholder="Pergunta (ex: Quando pretende comprar?)" value={key} onChange={(e) => setKey(e.target.value)} />
      <Input
        placeholder="Resposta (ex: Nos próximos 3 meses)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
      />
      <Button variant="outline" size="sm" onClick={add} disabled={!key.trim() || !value.trim()} aria-label="Adicionar pergunta" title="Adicionar pergunta">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ---------------- Test ----------------

// Turno da conversa de teste. `media` é só de exibição — a API recebe apenas
// role/content, igual antes. `propertyCode` viaja junto da mídia: é o código
// que estava no campo QUANDO esta bolha foi gerada — não o do campo agora.
// Sem isto, "Mandar pra mim" numa bolha antiga reenviaria com o código ATUAL
// do campo, e como o token das FOTOS só faz sentido dentro do imóvel que o
// gerou, o teste sairia com as fotos de OUTRO imóvel.
type TestTurn = TestHistoryItem & { media?: TestMediaItem[]; propertyCode?: string };

// Cenário de teste: o contexto do lead + a primeira mensagem dele.
//
// Preencher nome, origem, interesse e formulário na mão a cada teste dá
// preguiça, e a preguiça leva a testar sempre o mesmo caso fácil — justamente
// o que não revela problema. Um clique monta o cenário inteiro.
interface TestScenario {
  id: string;
  label: string;
  hint: string;
  contactName: string;
  source: string;
  interest: string;
  formAnswers: Record<string, string>;
  /**
   * Conversa que JÁ aconteceu antes deste turno. Vazio = primeiro contato.
   *
   * Muda o comportamento na raiz, não só o clima: o prompt escolhe entre três
   * aberturas conforme o histórico. Com mensagem da IA no histórico ele entra em
   * CONTINUIDADE ("você JÁ conversou com este lead, NÃO recomece"); sem nada, roda
   * o roteiro de abertura inteiro, terminando na pergunta de intenção. Testar
   * "lead que já visitou" digitando uma frase num chat vazio testa o caso errado.
   */
  history?: TestHistoryItem[];
  /** Próxima mensagem do lead, já no campo — é só apertar enviar. */
  firstMessage: string;
}

// Os casos que separam uma IA que funciona de uma que parece funcionar. Cada um
// checa um comportamento específico, descrito no `hint`.
//
// Metade tem conversa já semeada, e não é enfeite: o prompt escolhe a abertura
// pelo histórico. Um lead "que já visitou" digitado num chat VAZIO é, pro
// sistema, um primeiro contato — ele roda o roteiro de abertura e a pergunta de
// intenção, e o teste acaba medindo o caso errado.
const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'ctwa',
    label: 'Veio do anúncio',
    hint: 'O caso mais comum. Confere se ela abre citando o empreendimento e faz a pergunta de intenção — sem despejar preço.',
    contactName: 'Camila',
    source: 'Anúncio Instagram — clique para WhatsApp',
    interest: '',
    formAnswers: {},
    firstMessage: 'oi, vi o anúncio',
  },
  {
    id: 'form',
    label: 'Formulário do Meta',
    hint: 'O lead já respondeu no anúncio. Ela NÃO pode perguntar de novo o que está aqui embaixo.',
    contactName: 'Rodrigo',
    source: 'Formulário Meta Lead Ads',
    interest: '',
    formAnswers: {
      'Quando pretende comprar?': 'Nos próximos 3 meses',
      'Faixa de investimento': 'Até 450 mil',
      'É para morar ou investir?': 'Morar',
    },
    firstMessage: 'oi',
  },
  {
    id: 'visitou-primeiro-contato',
    label: 'Visitou, 1º contato',
    hint: 'Visitou o plantão no fim de semana e manda a PRIMEIRA mensagem. Sem histórico, o prompt roda o roteiro de abertura — confira se ela insiste na pergunta de intenção mesmo o lead já tendo visitado.',
    contactName: 'Patrícia',
    source: 'Anúncio Instagram',
    interest: 'Já visitou o decorado',
    formAnswers: {},
    firstMessage: 'eu já visitei semana passada, queria as plantas e o lazer',
  },
  {
    id: 'conversa-andando',
    label: 'Conversa em andamento',
    hint: 'A IA já falou antes. Tem que CONTINUAR de onde parou: nada de se reapresentar, repetir a saudação ou refazer a pergunta de intenção.',
    contactName: 'Patrícia',
    source: 'Anúncio Instagram',
    interest: '',
    formAnswers: {},
    history: [
      { role: 'user', content: 'oi, vi o anúncio' },
      {
        role: 'assistant',
        content:
          'Patrícia, olá, tudo bem? Sou o Eduardo, consultor imobiliário. Vi que você se cadastrou agorinha no nosso anúncio. Queria entender de fato o que você está buscando: seu foco é moradia, investimento, ou ainda não sabe e tá só sondando?',
      },
      { role: 'user', content: 'é pra morar, eu e meu marido' },
      {
        role: 'assistant',
        content: 'Que bom, Patrícia. Vocês estão pensando em quantos quartos? E tem alguma região que faz mais sentido pro dia a dia de vocês?',
      },
      { role: 'user', content: '2 quartos, de preferência perto do metrô' },
    ],
    firstMessage: 'consegue me mandar as plantas?',
  },
  {
    id: 'voltou',
    label: 'Sumiu e voltou',
    hint: 'Conversa parada há dias e o lead reaparece. Ela tem que retomar o assunto, não abrir de novo como se fosse um lead novo.',
    contactName: 'Thiago',
    source: 'Anúncio Facebook',
    interest: '',
    formAnswers: {},
    history: [
      { role: 'user', content: 'quanto tá o de 2 quartos?' },
      {
        role: 'assistant',
        content:
          'Thiago, tudo bem? Sou o Eduardo. Antes de falar de valor, queria entender: é pra morar ou pra investir?',
      },
      { role: 'user', content: 'investir' },
      {
        role: 'assistant',
        content: 'Show. Qual faixa de investimento você tá confortável pra esse tipo de projeto?',
      },
    ],
    firstMessage: 'desculpa a demora, sumi aqui. ainda dá pra ver esse apê?',
  },
  {
    id: 'fora-do-perfil',
    label: 'Fora do perfil',
    hint: 'Pede algo que o imóvel do anúncio não é. Confere se ela oferece alternativa REAL do catálogo, com preço, em vez de empurrar pro corretor.',
    contactName: 'Marcos',
    source: 'Anúncio Facebook',
    interest: '',
    formAnswers: {},
    firstMessage: 'esse é muito pequeno, tem de 3 quartos em outro bairro?',
  },
  {
    id: 'sondando',
    label: 'Só sondando',
    hint: 'Sem intenção definida. Ela tem que nutrir com leveza, sem pressão e sem insistir na pergunta de intenção.',
    contactName: 'Bruno',
    source: 'Anúncio Instagram',
    interest: '',
    formAnswers: {},
    firstMessage: 'to só dando uma olhada por enquanto',
  },
];

// Cenários que o próprio usuário salva. localStorage e não banco: é ferramenta
// de bancada, some se trocar de navegador, e não vale poluir a config do agente
// (que é dado de produção) com material de teste.
const SCENARIOS_KEY = 'lmflow:sales-agent-test-scenarios';

function loadSavedScenarios(): TestScenario[] {
  try {
    const raw = localStorage.getItem(SCENARIOS_KEY);
    return raw ? (JSON.parse(raw) as TestScenario[]) : [];
  } catch {
    return [];
  }
}

function persistScenarios(list: TestScenario[]) {
  try {
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify(list));
  } catch {
    // Cota cheia ou storage bloqueado: o cenário se perde, mas o teste continua.
  }
}

// Exportado só pra teste (mesmo padrão de TriggersSection): renderizar a tela
// inteira pra testar uma bolha do painel Testar exigiria simular login,
// tenant e dezenas de outras chamadas sem relação com o bug em questão.
export function TestTab({ agent }: { agent: SalesAgent }) {
  const { perguntar, dialogoDePergunta } = usePergunta();
  const [history, setHistory] = useState<TestTurn[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<SalesAgentTestResult | null>(null);
  const [propertyCode, setPropertyCode] = useState('');
  // O runner real manda a mídia UMA vez por imóvel, não a cada mensagem. Sem isto
  // o teste repetiria a foto em todo turno e daria uma impressão errada.
  const [mediaShownFor, setMediaShownFor] = useState<string | null>(null);

  // Contexto do lead. O nome era chumbado como "Lead Teste" e origem, interesse e
  // respostas do formulário nunca eram enviados — o backend sempre aceitou os
  // quatro. Sem eles a IA não sabe que o lead veio de um anúncio nem o que ele já
  // respondeu, e a conversa de teste sai mais fria e mais genérica que a real.
  const [contactName, setContactName] = useState('Lead Teste');
  const [source, setSource] = useState('');
  const [interest, setInterest] = useState('');
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});
  const [loadRef, setLoadRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState<TestScenario[]>(() => loadSavedScenarios());

  // Aplicar um cenário SUBSTITUI a conversa pela do cenário (vazia, quando ele
  // não tem histórico). Mesclar com o que estava na tela criaria uma conversa que
  // não existe em lugar nenhum — e o histórico é justamente o que decide se o
  // prompt abre do zero ou continua de onde parou.
  const applyScenario = (s: TestScenario) => {
    setContactName(s.contactName);
    setSource(s.source);
    setInterest(s.interest);
    setFormAnswers({ ...s.formAnswers });
    setMessage(s.firstMessage);
    setHistory((s.history ?? []).map((m) => ({ ...m })));
    setLast(null);
    setMediaShownFor(null);
  };

  const saveCurrentScenario = async () => {
    const label = await perguntar({
      titulo: 'Salvar cenário',
      descricao: 'A conversa da tela vira o histórico do cenário, pra você poder repetir este caso depois.',
      rotuloDoCampo: 'Nome do cenário',
      placeholder: 'Ex.: lead frio que some no meio',
      rotuloDaAcao: 'Salvar cenário',
    });
    if (!label) return;

    const scenario: TestScenario = {
      id: `custom-${label.toLowerCase().replace(/\s+/g, '-')}`,
      label,
      hint: 'Cenário salvo por você.',
      contactName,
      source,
      interest,
      formAnswers: { ...formAnswers },
      // A conversa da tela vira o histórico do cenário — inclusive a que você
      // acabou de rodar. É assim que se guarda "aquele caso que deu errado" pra
      // conferir depois se a mudança no prompt resolveu.
      history: history.map(({ role, content }) => ({ role, content })),
      firstMessage: message.trim(),
    };
    // Mesmo nome sobrescreve, em vez de duplicar na lista.
    const next = [...savedScenarios.filter((s) => s.id !== scenario.id), scenario];
    setSavedScenarios(next);
    persistScenarios(next);
    toast.success(`Cenário "${label}" salvo`);
  };

  const removeScenario = (id: string) => {
    const next = savedScenarios.filter((s) => s.id !== id);
    setSavedScenarios(next);
    persistScenarios(next);
  };

  const send = async () => {
    if (!message.trim()) return;
    const userMsg = message.trim();
    const code = propertyCode.trim();
    setMessage('');
    setBusy(true);
    const apiHistory: TestHistoryItem[] = history.map(({ role, content }) => ({ role, content }));
    const newHistory: TestTurn[] = [...history, { role: 'user', content: userMsg }];
    setHistory(newHistory);
    try {
      const result = await salesAgentsService.testRun(agent.id, userMsg, apiHistory, {
        contactName: contactName.trim() || 'Lead Teste',
        source: source.trim(),
        interest: interest.trim(),
        formAnswers,
        propertyCode: code,
      });
      const firstTimeForThisProperty = mediaShownFor !== code;
      const media = firstTimeForThisProperty ? result.media ?? [] : [];
      if (media.length > 0) setMediaShownFor(code);
      // Uma bolha por MENSAGEM, não por turno: é assim que o lead recebe quando a
      // quebra está ligada. Mostrar uma bolha só faria quem liga a chave e testa
      // aqui concluir que ela não funciona. A mídia fica pendurada na última,
      // porque no atendimento real ela sai depois de todo o texto.
      const parts = result.reply_parts?.length ? result.reply_parts : [result.reply];
      setHistory([
        ...newHistory,
        ...parts.map((content, i) => ({
          role: 'assistant' as const,
          content,
          media: i === parts.length - 1 ? media : [],
          // O código DESTE turno, não o que estiver no campo quando o dono
          // clicar em "Mandar pra mim" depois.
          propertyCode: code,
        })),
      ]);
      setLast(result);
    } catch {
      toast.error('Erro no teste (verifique se a chave da IA está configurada)');
    } finally {
      setBusy(false);
    }
  };

  const loadRealConversation = async () => {
    const ref = loadRef.trim();
    if (!ref) return;
    setLoading(true);
    try {
      // Aceita ID de conversa ou telefone: quem está testando quase sempre tem o
      // telefone à mão, não o UUID.
      const isPhone = /^[\d\s()+-]+$/.test(ref);
      const ctx = await salesAgentsService.conversationContext(
        agent.id,
        isPhone ? { phone: ref } : { conversationId: ref },
      );
      setHistory(ctx.history);
      setContactName(ctx.contact_name ?? 'Lead Teste');
      setSource(ctx.source ?? '');
      setInterest(ctx.interest ?? '');
      setFormAnswers(ctx.form_answers ?? {});
      if (ctx.property_code) setPropertyCode(ctx.property_code);
      setMediaShownFor(null);
      setLast(null);
      toast.success(`Conversa carregada — ${ctx.history.length} mensagens`);
    } catch {
      toast.error('Não achei essa conversa (tente o telefone com DDD ou o ID).');
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setHistory([]);
    setLast(null);
    setMediaShownFor(null);
    setFormAnswers({});
    setSource('');
    setInterest('');
    setContactName('Lead Teste');
  };

  const formAnswerEntries = Object.entries(formAnswers);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Converse como se fosse o lead. Não envia nada no WhatsApp — é só teste.</p>

      {/* Carregar conversa real: o teste digitado à mão não reproduz o que o lead
          traz (nome, campanha, formulário, imóvel resolvido), e é justamente isso
          que faz a IA saber do que está falando. Só leitura — nada é enviado. */}
      <div className="border border-sidebar-border rounded-md p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bot className="h-4 w-4" /> Carregar uma conversa real
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Telefone com DDD ou ID da conversa"
            value={loadRef}
            onChange={(e) => setLoadRef(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void loadRealConversation(); }}
          />
          <Button variant="outline" onClick={() => void loadRealConversation()} disabled={loading || !loadRef.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Carregar'}
          </Button>
          {history.length > 0 && (
            <Button variant="ghost" onClick={clearAll}>Limpar</Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Traz o histórico e o contexto de um lead de verdade pra você continuar a conversa daqui.
          Não envia mensagem nem grava nada — pode apontar pra um lead ativo.
        </p>
      </div>

      {/* Cenários prontos. Cada um monta o contexto inteiro e já deixa a primeira
          mensagem no campo — é só apertar enviar. Sem isto, digitar tudo de novo
          a cada teste leva a testar sempre o mesmo caso fácil, que é o que menos
          revela problema. */}
      <div className="border border-sidebar-border rounded-md p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Zap className="h-4 w-4" /> Cenários
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void saveCurrentScenario()}>
            Salvar o atual
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TEST_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.hint}
              onClick={() => applyScenario(s)}
              className="inline-flex items-center gap-1 rounded-md border border-sidebar-border px-2.5 py-1 text-xs hover:bg-muted transition-colors"
            >
              {s.label}
              {/* Marca quem já vem com conversa: é a diferença entre testar a
                  abertura e testar a continuidade, e não dá pra adivinhar pelo nome. */}
              {(s.history?.length ?? 0) > 0 && (
                <span className="text-[10px] text-muted-foreground" title="Já vem com conversa">
                  💬
                </span>
              )}
            </button>
          ))}
          {savedScenarios.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center rounded-md border border-primary/40 bg-primary/5 text-xs"
            >
              <button
                type="button"
                title={s.hint}
                onClick={() => applyScenario(s)}
                className="px-2.5 py-1 hover:bg-primary/10 rounded-l-md transition-colors"
              >
                {s.label}
              </button>
              <button
                type="button"
                title="Remover cenário"
                onClick={() => removeScenario(s.id)}
                className="px-1.5 py-1 text-muted-foreground hover:text-red-500"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Passe o mouse pra ver o que cada um testa. Os marcados com 💬 já vêm com uma conversa
          anterior — e isso muda a resposta: sem histórico ela abre do zero, com histórico ela
          continua de onde parou. Aplicar um cenário substitui a conversa da tela.
          Ao salvar o seu, a conversa atual vai junto.
        </p>
      </div>

      {/* Contexto do lead. O backend sempre aceitou estes campos; a tela mandava
          só o nome, chumbado como "Lead Teste". */}
      <div className="border border-sidebar-border rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal className="h-4 w-4" /> Contexto do lead
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <Label htmlFor="test_name" className="text-xs">Nome</Label>
            <Input id="test_name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="test_source" className="text-xs">Origem</Label>
            <Input
              id="test_source"
              placeholder="Anúncio Instagram — Vivaz Mooca"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="test_interest" className="text-xs">Interesse inicial</Label>
            <Input
              id="test_interest"
              placeholder="2 quartos até 400 mil"
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Respostas do formulário do Meta</Label>
          {formAnswerEntries.length > 0 && (
            <div className="space-y-1 mt-1 mb-2">
              {formAnswerEntries.map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="font-medium">{k}:</span>
                  <span className="flex-1 truncate text-muted-foreground">{v}</span>
                  <button
                    type="button"
                    className="text-red-500 hover:underline"
                    onClick={() => setFormAnswers((prev) => {
                      const next = { ...prev };
                      delete next[k];
                      return next;
                    })}
                  >
                    remover
                  </button>
                </div>
              ))}
            </div>
          )}
          <FormAnswerAdder onAdd={(k, v) => setFormAnswers((prev) => ({ ...prev, [k]: v }))} />
          <p className="text-xs text-muted-foreground mt-1">
            A IA usa pra não perguntar de novo o que o lead já respondeu no anúncio.
          </p>
        </div>
      </div>

      <PropertyLinkBox agent={agent} propertyCode={propertyCode} onCodeChange={setPropertyCode} />

      <div className="border border-sidebar-border rounded-md p-3 h-72 overflow-auto space-y-2 bg-muted/20">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Mande uma mensagem pra ver a IA responder.</p>
        ) : (
          history.map((h, i) => (
            <div key={i} className="space-y-1">
              <div className={`flex ${h.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${h.role === 'user' ? 'bg-background border' : 'bg-primary/10 text-foreground'}`}>
                  {h.content}
                </div>
              </div>
              {(h.media ?? []).map((m, j) => (
                <div key={j} className="flex justify-end">
                  <TestMediaBubble
                    item={m}
                    onSendToMe={(item, phone) => salesAgentsService.testSend(agent.id, {
                      // O código do TURNO que gerou esta bolha, não o do campo
                      // agora — o campo pode ter mudado de imóvel desde então.
                      phone, token: item.token, property_code: h.propertyCode || undefined,
                    }).then((r) => r.message)}
                  />
                </div>
              ))}
            </div>
          ))
        )}
        {busy && <div className="flex justify-end"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Mensagem do lead..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        />
        <Button onClick={send} disabled={busy || !message.trim()} aria-label="Enviar" title="Enviar"><Send className="h-4 w-4" /></Button>
      </div>

      {last && (
        <div className="text-xs text-muted-foreground border border-sidebar-border rounded-md p-3 space-y-1">
          <div>Temperatura: <strong>{TEMP_LABEL[last.temperature] ?? last.temperature}</strong></div>
          {last.should_transfer && <div className="text-amber-600">Transferiria pro corretor: {last.transfer_reason}</div>}
          {last.lead_summary && <div>Resumo: {last.lead_summary}</div>}
        </div>
      )}

      {dialogoDePergunta}
    </div>
  );
}

export default function TelaTestar({ agent }: { agent: SalesAgent }) {
  return <TestTab agent={agent} />;
}
