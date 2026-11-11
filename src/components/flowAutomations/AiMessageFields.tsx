import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, Textarea } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import { Seletor } from '@/components/base/Seletor';
import { CampoDaJanela, GrupoDaJanela } from '@/components/base/janela';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import { sendFromOf } from '@/features/numbers/sendFrom';
import type { AiMessageLead, AiMessagePreview } from '@/types/flowAutomations';
import { VariableChipBar } from './VariableChipBar';
import { PularSeIaConversandoField } from './MessageBlockFields';
import { BolhaDoWhatsapp } from './BolhaDoWhatsapp';

// Miolo da janela do bloco "Mensagem com IA" (11/11/2026). De cima pra baixo: a
// instrução e a reserva (com a barra de variáveis), o Testar (um lead real, a
// mensagem num balão de WhatsApp e as respostas que a IA leu) e o envio (por onde
// sai, a caixinha da IA e o aviso do próximo bloco). O Testar mora DENTRO da
// janela: nada de botão solto ao lado do Salvar.

const AJUDA_DA_INSTRUCAO =
  'Diga quem fala, o tom, o que citar do formulário e como terminar. A IA lê sozinha as respostas do formulário do lead.';
const AVISO_DO_PROXIMO_BLOCO = 'O próximo bloco precisa combinar com a pergunta que a instrução manda fazer.';

type Config = Record<string, unknown>;

const texto = (v: unknown) => (typeof v === 'string' ? v : '');

function rotuloDoLead(lead: AiMessageLead): string {
  const data = new Date(lead.created_at);
  const quando = Number.isNaN(data.getTime()) ? '' : data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return [lead.name, lead.form_name, quando].filter(Boolean).join(' · ');
}

type Leads = { estado: 'carregando' } | { estado: 'pronto'; lista: AiMessageLead[] } | { estado: 'erro'; frase: string };

function TestarMensagem({ config, automationId, formId, inboxDoTeste }: {
  config: Config;
  automationId: string;
  formId: string | null;
  inboxDoTeste: string | null;
}) {
  const [leads, setLeads] = useState<Leads>({ estado: 'carregando' });
  const [leadId, setLeadId] = useState('');
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<AiMessagePreview | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [respostasAbertas, setRespostasAbertas] = useState(false);
  // Só vale a resposta do último pedido (trocar de lead no meio descarta a anterior).
  const pedido = useRef(0);
  const campoId = useId();

  useEffect(() => {
    let vivo = true;
    setLeads({ estado: 'carregando' });
    setLeadId('');
    setResultado(null);
    flowAutomationsService
      .aiMessageLeads(automationId, formId ?? undefined)
      .then(lista => {
        if (!vivo) return;
        setLeads({ estado: 'pronto', lista });
        // Abre no lead mais novo: escolher nome é um passo a mais que faz desistir
        // de testar (mesma regra do Testar da IA Vendedora).
        setLeadId(lista[0]?.id ?? '');
      })
      .catch((e: unknown) => { if (vivo) setLeads({ estado: 'erro', frase: e instanceof Error ? e.message : String(e) }); });
    return () => {
      vivo = false;
      pedido.current += 1;
    };
  }, [automationId, formId]);

  // Esquece o resultado na tela e qualquer resposta ainda a caminho.
  const esquecerResultado = () => {
    pedido.current += 1;
    setResultado(null);
    setErro(null);
    setTestando(false);
    setRespostasAbertas(false);
  };

  const escolherLead = (id: string) => {
    esquecerResultado();
    setLeadId(id);
  };

  // Mexeu na instrução ou na reserva: o balão mostrado já não é o desse texto.
  const instrucao = texto(config.instruction);
  const reserva = texto(config.fallback_text);
  const primeiraVez = useRef(true);
  useEffect(() => {
    if (primeiraVez.current) { primeiraVez.current = false; return; }
    esquecerResultado();
  }, [instrucao, reserva]); // eslint-disable-line react-hooks/exhaustive-deps -- só quando o texto muda

  const testar = async () => {
    const meu = ++pedido.current;
    setTestando(true);
    setErro(null);
    try {
      const r = await flowAutomationsService.aiMessagePreview(automationId, {
        instruction: instrucao,
        fallback_text: reserva,
        contact_id: leadId,
        send_from_inbox_id: inboxDoTeste,
      });
      if (meu !== pedido.current) return;
      setResultado(r);
    } catch (e) {
      if (meu !== pedido.current) return;
      setResultado(null);
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (meu === pedido.current) setTestando(false);
    }
  };

  const lista = leads.estado === 'pronto' ? leads.lista : [];
  const lead = lista.find(l => l.id === leadId);
  const respostas = resultado ? Object.entries(resultado.answers ?? {}) : [];

  return (
    <GrupoDaJanela titulo="Testar">
      <CampoDaJanela
        rotulo="Lead pra testar"
        htmlFor={campoId}
        ajuda={leads.estado === 'pronto' && lista.length === 0
          ? 'Nenhum lead com respostas de formulário ainda.'
          : 'Leads reais com respostas de formulário. O teste não manda nada pro lead.'}
      >
        <Seletor
          id={campoId}
          aria-label="Lead pra testar"
          value={leadId}
          onChange={e => escolherLead(e.target.value)}
          disabled={leads.estado !== 'pronto' || lista.length === 0}
          className="w-full"
        >
          <option value="">{leads.estado === 'carregando' ? 'Carregando os leads…' : 'Escolha um lead'}</option>
          {lista.map(l => <option key={l.id} value={l.id}>{rotuloDoLead(l)}</option>)}
        </Seletor>
      </CampoDaJanela>
      {leads.estado === 'erro' && <Aviso tom="erro" compacto>{leads.frase}</Aviso>}
      <div>
        <Button type="button" variant="outline" size="sm" disabled={!leadId || testando} onClick={() => void testar()}>
          {testando ? 'Escrevendo…' : resultado ? 'Gerar de novo' : 'Testar mensagem'}
        </Button>
      </div>
      {erro && <Aviso tom="erro" compacto>{erro}</Aviso>}
      {resultado && (
        <div className="grid gap-2">
          {resultado.source === 'reserva' && (
            <Aviso tom="atencao" compacto>{resultado.reason_text || 'Saiu a mensagem reserva.'}</Aviso>
          )}
          <BolhaDoWhatsapp texto={resultado.text} nome={lead?.name} />
          {respostas.length > 0 && (
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={respostasAbertas}
                onClick={() => setRespostasAbertas(a => !a)}
                className="h-8 px-2 text-xs"
              >
                Respostas que a IA leu ({respostas.length})
              </Button>
              {respostasAbertas && (
                <dl className="mt-1 grid gap-1.5 px-2 text-xs">
                  {respostas.map(([pergunta, resposta]) => (
                    <div key={pergunta}>
                      <dt className="text-muted-foreground">{pergunta}</dt>
                      <dd className="text-foreground">{resposta}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>
      )}
    </GrupoDaJanela>
  );
}

export function AiMessageFields({ config, onChange, readOnly, automationId, formId = null, numeroDoFluxo, inboxDoFluxo = null }: {
  config: Config;
  onChange: (config: Config) => void;
  /** Modo guiado: o corretor só vê o bloco (o servidor não deixa ele mudar). */
  readOnly: boolean;
  /** O fluxo: o Testar e a lista de leads são dele. */
  automationId: string;
  /** O formulário do gatilho (um só), pra lista de leads do Testar. */
  formId?: string | null;
  /** Por onde sai: a linha do número do fluxo (ou o seletor do fluxo antigo), montada pelo painel. */
  numeroDoFluxo?: ReactNode;
  /** O número específico do fluxo: o Testar fala como o dono dele. */
  inboxDoFluxo?: string | null;
}) {
  const instrucaoId = useId();
  const reservaId = useId();
  const instrucaoRef = useRef<HTMLTextAreaElement>(null);
  const reservaRef = useRef<HTMLTextAreaElement>(null);
  const instrucao = texto(config.instruction);
  const reserva = texto(config.fallback_text);
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value });
  const envio = sendFromOf(config);
  const inboxDoTeste = inboxDoFluxo || (envio.send_from === 'number' ? envio.send_from_inbox_id || null : null);

  return (
    <div className="space-y-5">
      <GrupoDaJanela titulo="Mensagem">
        <CampoDaJanela rotulo="Instrução para a IA" htmlFor={instrucaoId} obrigatorio ajuda={AJUDA_DA_INSTRUCAO}>
          <Textarea
            id={instrucaoId}
            ref={instrucaoRef}
            value={instrucao}
            onChange={e => set('instruction', e.target.value)}
            rows={8}
            maxLength={4000}
            disabled={readOnly}
          />
          {!readOnly && <VariableChipBar targetRef={instrucaoRef} value={instrucao} onChange={next => set('instruction', next)} />}
        </CampoDaJanela>
        <CampoDaJanela rotulo="Mensagem reserva" htmlFor={reservaId} obrigatorio ajuda="Sai se a IA não responder.">
          <Textarea
            id={reservaId}
            ref={reservaRef}
            value={reserva}
            onChange={e => set('fallback_text', e.target.value)}
            rows={3}
            maxLength={1000}
            className="resize-none"
            disabled={readOnly}
          />
          {!readOnly && <VariableChipBar targetRef={reservaRef} value={reserva} onChange={next => set('fallback_text', next)} />}
        </CampoDaJanela>
      </GrupoDaJanela>
      {!readOnly && (automationId ? (
        <TestarMensagem config={config} automationId={automationId} formId={formId} inboxDoTeste={inboxDoTeste} />
      ) : (
        // Guarda: o construtor só abre com o fluxo já salvo, então isto não deveria aparecer.
        <GrupoDaJanela titulo="Testar">
          <Aviso tom="neutro" compacto>Salve o fluxo pra testar a mensagem.</Aviso>
        </GrupoDaJanela>
      ))}
      <GrupoDaJanela titulo="Envio">
        {numeroDoFluxo}
        {!readOnly && (
          <PularSeIaConversandoField config={config} onChange={next => set('skip_if_ai_talking', next.skip_if_ai_talking)} />
        )}
        <Aviso tom="neutro" compacto>{AVISO_DO_PROXIMO_BLOCO}</Aviso>
      </GrupoDaJanela>
    </div>
  );
}
