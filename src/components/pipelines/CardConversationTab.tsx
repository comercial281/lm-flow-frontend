import { memo, useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { Button, Textarea } from '@/components/ui/ds';
import { MessageCircle, Send, Loader2, RefreshCw, Paperclip, Rocket, Clock, X, Mic, Archive, ArchiveX, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { conversationAPI } from '@/services/conversations/conversationService';
import { chatService } from '@/services/chat/chatService';
import { httpStatusOf } from '@/services/leadFollowup/leadFollowupService';
import { DispararFunilPanel } from '@/components/chat/message-funnels/DispararFunilPanel';
import { useWebSocketContext } from '@/contexts/chat/WebSocketContext';
import {
  PERTO_DO_FIM_PX,
  PERTO_DO_TOPO_PX,
  aplicarPaginaRecente,
  instanteDaMensagem,
  juntarMensagens,
  mensagemDoErro,
  paginaDaResposta,
  temMaisAntigas,
} from './conversaDoCard';
import MessageImage from '@/components/chat/messages/MessageImage';
import MessageVideo from '@/components/chat/messages/MessageVideo';
import MessageFile from '@/components/chat/messages/MessageFile';
import MessageLocation from '@/components/chat/messages/MessageLocation';
import SystemMessage from '@/components/chat/messages/SystemMessage';
import type { PipelineItem } from '@/types/analytics';
import { MESSAGE_TYPE } from '@/types/chat/api';
import type { Message, Attachment } from '@/types/chat/api';

// Hook seguro — não lança se o WebSocketProvider não estiver na árvore acima.
function useSafeWsHandlers() {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { registerHandlers } = useWebSocketContext();
    return registerHandlers;
  } catch {
    return undefined;
  }
}

interface CardConversationTabProps {
  item: PipelineItem;
  /**
   * Agendar o envio do que está escrito na caixa (abre o agendamento de mensagem
   * com o texto). Substituiu o "Criar lembrete", que criava Retorno — a aba
   * Retorno saiu do card (nenhum cliente usava; spec 2026-10-02).
   */
  onAgendarEnvio?: (texto: string) => void;
}

const POLL_INTERVAL_MS = 8_000;

// Transcrever: pergunta ao servidor de 3 em 3 s, por até 2 minutos.
const ESPERA_DA_TRANSCRICAO_MS = 3_000;
const TENTATIVAS_DA_TRANSCRICAO = 40;

function formatTs(raw: string | number): string {
  const ts = typeof raw === 'number' ? raw * 1000 : Date.parse(String(raw));
  if (!ts || isNaN(ts)) return '';
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function isPhoneNumber(s?: string | null): boolean {
  if (!s) return false;
  return /^[+\d\s\-()\u{0041}-\u{005A}]{0,3}[\d\s\-().]{6,}$/u.test(s.trim()) && /\d{6,}/.test(s);
}

function resolveContactName(item: PipelineItem): string | null {
  const candidates = [
    item.conversation?.contact?.name,
    item.contact?.name,
  ];
  for (const n of candidates) {
    if (n && !isPhoneNumber(n)) return n;
  }
  return null;
}

// Áudio com transcrição: mostra a que o servidor já gravou (attachment.transcribed_text/meta);
// senão oferece "Transcrever", que pede ao SERVIDOR (a chave fica lá; até 12/10/2026 a tela
// chamava a OpenAI do navegador com a chave no código publicado).
function AudioAttachment({ att, conversationId, messageId }: { att: Attachment; conversationId: string; messageId: string }) {
  const url = att.data_url;
  const existing = att.transcribed_text || (att.meta as any)?.transcribed_text || null;
  const [transcribing, setTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(existing);
  const [erroTranscricao, setErroTranscricao] = useState<string | null>(null);
  // A pergunta de 3 em 3 s para se o card fechar no meio.
  const montado = useRef(true);
  useEffect(() => () => { montado.current = false; }, []);

  if (!url) return null;

  // O clique só COMEÇA (o servidor transcreve fora da requisição); a tela pergunta
  // como foi até ficar pronto. Perguntar nunca paga de novo: só um novo clique tenta.
  const handleTranscribe = async () => {
    setTranscribing(true);
    setErroTranscricao(null);
    try {
      const attachmentId = String(att.id);
      let res = await conversationAPI.transcribeAttachment(conversationId, messageId, attachmentId, true);
      for (let i = 0; res.status === 'pending' && i < TENTATIVAS_DA_TRANSCRICAO; i++) {
        await new Promise(resolve => setTimeout(resolve, ESPERA_DA_TRANSCRICAO_MS));
        if (!montado.current) return;
        res = await conversationAPI.transcribeAttachment(conversationId, messageId, attachmentId, false);
      }
      if (!montado.current) return;
      if (res.status === 'done' && res.transcribed_text) setTranscription(res.transcribed_text);
      else setErroTranscricao('Não deu pra transcrever este áudio.');
    } catch (e) {
      if (montado.current) setErroTranscricao(mensagemDoErro(e, 'Não deu pra transcrever este áudio.'));
    } finally {
      if (montado.current) setTranscribing(false);
    }
  };

  return (
    <div className="mt-1 space-y-1">
      <audio controls src={url} className="w-full max-w-xs" />
      {transcription ? (
        <div className="rounded-md bg-muted/60 px-2 py-1.5 text-xs text-foreground leading-relaxed">
          {transcription}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={handleTranscribe}
            disabled={transcribing}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {transcribing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
            {transcribing ? 'Transcrevendo...' : 'Transcrever'}
          </button>
          {erroTranscricao && <p className="text-[10px] text-destructive">{erroTranscricao}</p>}
        </>
      )}
    </div>
  );
}

// Anexos pelos MESMOS componentes da tela de Conversas (MessageImage/Video/
// File/Location) — antes essa aba lia `att.url`, mas o backend manda
// `data_url`; a imagem/vídeo nunca tinha src e a mídia simplesmente sumia.
// Reusar os componentes reais elimina essa classe de bug de vez (fica
// idêntico ao que o corretor vê na tela de Conversas, garantido).
function MessageAttachments({ attachments, conversationId, messageId }: { attachments: Attachment[]; conversationId: string; messageId: string }) {
  if (attachments.length === 0) return null;
  const fileType = attachments[0]?.file_type;
  switch (fileType) {
    case 'image':
      return <div className="mt-1"><MessageImage attachments={attachments} /></div>;
    case 'video':
      return <div className="mt-1"><MessageVideo attachments={attachments} /></div>;
    case 'location':
      return <div className="mt-1"><MessageLocation attachments={attachments} /></div>;
    case 'audio':
      return (
        <>
          {attachments.map(att => (
            <AudioAttachment key={att.id} att={att} conversationId={conversationId} messageId={messageId} />
          ))}
        </>
      );
    default:
      return <div className="mt-1"><MessageFile attachments={attachments} /></div>;
  }
}

const MessageBubble = memo(function MessageBubble({ m, isOutgoing, conversationId }: { m: Message; isOutgoing: boolean; conversationId: string }) {
  const attachments = m.attachments ?? [];
  return (
    <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
      isOutgoing ? 'bg-primary text-primary-foreground' : 'bg-card border'
    }`}>
      {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
      <MessageAttachments attachments={attachments} conversationId={conversationId} messageId={String(m.id)} />
      {!m.content && attachments.length === 0 && (
        <em className="text-xs opacity-70">[mídia]</em>
      )}
      <div className={`mt-1 text-[10px] ${isOutgoing ? 'opacity-70' : 'text-muted-foreground'}`}>
        {formatTs(m.created_at)}
      </div>
    </div>
  );
});

export default function CardConversationTab({ item, onAgendarEnvio }: CardConversationTabProps) {
  // conversationId: prioriza conversa direta do item, depois whatsapp_conversation_id
  // (form leads que têm conversa WA associada ao contato mas não ao pipeline item).
  const conversationId =
    (item.conversation?.id ? String(item.conversation.id) : null) ??
    ((item as any).conversation_id ? String((item as any).conversation_id) : null) ??
    ((item as any).whatsapp_conversation_id ? String((item as any).whatsapp_conversation_id) : null) ??
    (item.type === 'conversation' ? item.item_id : null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  // Falha que não é 404 (rede, 5xx, 401). Só aparece com a lista vazia: com mensagens
  // na tela, a releitura de 8 em 8 s que falha fica calada (não pisca erro em cima da conversa).
  const [erro, setErro] = useState(false);
  // Mensagens antigas (spec 2026-10-12): o servidor manda 20 por vez.
  // null = ainda não chegou a primeira página do servidor (não dá pra saber).
  const [temMais, setTemMais] = useState<boolean | null>(null);
  const [carregandoAnteriores, setCarregandoAnteriores] = useState(false);
  const [erroAnteriores, setErroAnteriores] = useState(false);
  // Chegou mensagem enquanto a pessoa lia o histórico: a caixa não pula, aparece o botão.
  const [novaMensagem, setNovaMensagem] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [funnelOpen, setFunnelOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isArchived, setIsArchived] = useState(
    Boolean(item.conversation?.custom_attributes?.archived)
  );
  const [archiving, setArchiving] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);
  // Espelho da lista: quem escreve passa por definirMensagens, então duas respostas
  // que chegam juntas (releitura + anteriores) não apagam uma à outra.
  const messagesRef = useRef<Message[]>([]);
  // O que fazer com a rolagem depois do próximo desenho da lista.
  const rolagemPendente = useRef<{ tipo: 'fim' } | { tipo: 'manter'; distanciaDoFim: number } | null>(null);
  // A primeira página do servidor chegou. Só o load liga: mensagem do tempo real que
  // chega antes dela (ou depois de uma falha) não decide se há anteriores.
  const paginaRecenteRecebida = useRef(false);
  const carregandoAnterioresRef = useRef(false);
  // Conversa de agora: resposta que chega depois de trocar de lead é jogada fora.
  const conversaAtual = useRef<string | null>(conversationId);
  const pollRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const contactName = resolveContactName(item);

  const definirMensagens = useCallback((proxima: Message[]) => {
    messagesRef.current = proxima;
    setMessages(proxima);
  }, []);

  const estaPertoDoFim = useCallback(() => {
    const caixa = caixaRef.current;
    if (!caixa) return true;
    return caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight <= PERTO_DO_FIM_PX;
  }, []);

  // Mensagens novas no fim (primeira carga, releitura, tempo real, envio).
  // irProFim: desce de qualquer jeito (primeira página do servidor, mensagem que a pessoa enviou).
  const receberRecentes = useCallback(
    (proxima: Message[], opcoes?: { minha?: boolean; irProFim?: boolean }) => {
      const anterior = messagesRef.current;
      const ultima = (lista: Message[]) => (lista.length ? String(lista[lista.length - 1].id) : null);
      const chegouNoFim = ultima(proxima) !== ultima(anterior);
      if (opcoes?.irProFim || anterior.length === 0 || (chegouNoFim && (opcoes?.minha || estaPertoDoFim()))) {
        rolagemPendente.current = { tipo: 'fim' };
        setNovaMensagem(false);
      } else if (chegouNoFim) {
        setNovaMensagem(true);
      }
      definirMensagens(proxima);
    },
    [definirMensagens, estaPertoDoFim],
  );

  // Trocou de lead: começa do zero (antes da primeira carga, pela ordem dos efeitos).
  useEffect(() => {
    conversaAtual.current = conversationId;
    paginaRecenteRecebida.current = false;
    rolagemPendente.current = null;
    carregandoAnterioresRef.current = false;
    messagesRef.current = [];
    setMessages([]);
    setTemMais(null);
    setErro(false);
    setErroAnteriores(false);
    setCarregandoAnteriores(false);
    setNovaMensagem(false);
  }, [conversationId]);

  // WebSocket — recebe mensagens em tempo real sem esperar o poll.
  const registerHandlers = useSafeWsHandlers();

  useEffect(() => {
    if (!registerHandlers || !conversationId) return;
    registerHandlers({
      onMessageCreated: (msg: Message) => {
        if (String((msg as any).conversation_id) !== conversationId) return;
        if (messagesRef.current.some(m => String(m.id) === String(msg.id))) return;
        receberRecentes(juntarMensagens(messagesRef.current, [msg]));
      },
    });
    return () => {
      // Limpa o handler ao desmontar
      registerHandlers({ onMessageCreated: undefined as any });
    };
  }, [registerHandlers, conversationId, receberRecentes]);

  const load = useCallback(
    async (opcoes?: { minha?: boolean }) => {
      if (!conversationId) return;
      setLoading(true);
      try {
        const pagina = paginaDaResposta(await conversationAPI.getMessages(conversationId));
        if (conversaAtual.current !== conversationId) return;
        const primeiraPagina = !paginaRecenteRecebida.current;
        paginaRecenteRecebida.current = true;
        if (primeiraPagina) setTemMais(temMaisAntigas(pagina));
        receberRecentes(aplicarPaginaRecente(messagesRef.current, pagina), {
          ...opcoes,
          irProFim: primeiraPagina,
        });
        setErro(false);
      } catch (e) {
        if (conversaAtual.current !== conversationId) return;
        // 404: o servidor não acha a conversa (ainda não existe) — o vazio é honesto.
        // Qualquer outra falha não pode virar "Nenhuma mensagem ainda.": o corretor
        // concluiria que nunca falou com o lead e mandaria a primeira mensagem de novo.
        setErro(httpStatusOf(e) !== 404);
      } finally {
        // Resposta da conversa anterior não mexe no "carregando" da de agora.
        if (conversaAtual.current === conversationId) setLoading(false);
      }
    },
    [conversationId, receberRecentes],
  );

  const carregarAnteriores = useCallback(async () => {
    const maisAntiga = messagesRef.current[0];
    if (!conversationId || !maisAntiga || carregandoAnterioresRef.current) return;
    carregandoAnterioresRef.current = true;
    setCarregandoAnteriores(true);
    setErroAnteriores(false);
    try {
      const pagina = paginaDaResposta(
        await conversationAPI.getMessages(conversationId, { before: String(maisAntiga.id) }),
      );
      if (conversaAtual.current !== conversationId) return;
      // Não avançou (a mais antiga foi apagada e o servidor ignora o before, devolvendo
      // as últimas de novo): para aqui, senão a caixa pede a mesma página pra sempre.
      const naTela = new Set(messagesRef.current.map(msg => String(msg.id)));
      const limite = instanteDaMensagem(maisAntiga);
      const avancou = pagina.some(msg => !naTela.has(String(msg.id)) && instanteDaMensagem(msg) <= limite);
      if (!avancou) {
        setTemMais(false);
        return;
      }
      const caixa = caixaRef.current;
      // Guarda a distância do FIM, não do topo: o que entra é em cima. O Safari não
      // segura a posição sozinho quando o conteúdo cresce pra cima.
      if (caixa) rolagemPendente.current = { tipo: 'manter', distanciaDoFim: caixa.scrollHeight - caixa.scrollTop };
      definirMensagens(juntarMensagens(messagesRef.current, pagina));
      setTemMais(temMaisAntigas(pagina));
    } catch {
      if (conversaAtual.current === conversationId) setErroAnteriores(true);
    } finally {
      if (conversaAtual.current === conversationId) {
        carregandoAnterioresRef.current = false;
        setCarregandoAnteriores(false);
      }
    }
  }, [conversationId, definirMensagens]);

  useEffect(() => {
    if (!conversationId) return;
    load();
    pollRef.current = window.setInterval(() => load(), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [conversationId, load]);

  // Rolagem só dentro da caixa. Nada de scrollIntoView: ele rola também a página
  // do card (e a janela) pra mostrar o fim da conversa.
  useLayoutEffect(() => {
    const caixa = caixaRef.current;
    const pendente = rolagemPendente.current;
    if (!caixa || !pendente) return;
    rolagemPendente.current = null;
    caixa.scrollTop =
      pendente.tipo === 'fim' ? caixa.scrollHeight : caixa.scrollHeight - pendente.distanciaDoFim;
  }, [messages]);

  // Conversa que não enche a caixa não tem como rolar pra cima: carrega sozinha.
  useEffect(() => {
    const caixa = caixaRef.current;
    if (!caixa || !temMais || erroAnteriores || carregandoAnteriores || messages.length === 0) return;
    if (caixa.scrollHeight <= caixa.clientHeight) void carregarAnteriores();
  }, [messages, temMais, erroAnteriores, carregandoAnteriores, carregarAnteriores]);

  const aoRolar = () => {
    const caixa = caixaRef.current;
    if (!caixa) return;
    if (novaMensagem && estaPertoDoFim()) setNovaMensagem(false);
    if (caixa.scrollTop < PERTO_DO_TOPO_PX && temMais && !erroAnteriores) void carregarAnteriores();
  };

  const irProFim = () => {
    const caixa = caixaRef.current;
    if (caixa) caixa.scrollTop = caixa.scrollHeight;
    setNovaMensagem(false);
  };

  const doSend = async (content: string, files?: File[]) => {
    if (!conversationId) return;
    const enviada = await conversationAPI.sendMessage(conversationId, {
      content,
      message_type: 'outgoing',
      attachments: files,
    });
    if (conversaAtual.current !== conversationId) return;
    // Quem enviou vai pro fim, mesmo lendo o histórico. O eco do tempo real costuma
    // chegar antes desta resposta (e aí a releitura não vê mensagem nova no fim).
    const lista = enviada && (enviada as Message).id != null
      ? juntarMensagens(messagesRef.current, [enviada])
      : [...messagesRef.current];
    receberRecentes(lista, { irProFim: true });
    await load({ minha: true });
  };

  const send = async () => {
    if (!conversationId || (!text.trim() && pendingFiles.length === 0)) return;
    setSending(true);
    try {
      await doSend(text.trim(), pendingFiles.length > 0 ? pendingFiles : undefined);
      setText('');
      setPendingFiles([]);
    } catch {
      toast.error('Falha ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPendingFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const toggleArchive = async () => {
    if (!conversationId) return;
    setArchiving(true);
    try {
      if (isArchived) {
        await chatService.unarchiveConversation(conversationId);
        setIsArchived(false);
        toast.success('Conversa desarquivada');
      } else {
        await chatService.archiveConversation(conversationId);
        setIsArchived(true);
        toast.success('Conversa arquivada');
      }
    } catch {
      toast.error('Falha ao arquivar conversa');
    } finally {
      setArchiving(false);
    }
  };

  if (!conversationId) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <MessageCircle className="h-10 w-10 text-muted-foreground" />
        <p className="font-medium">Sem conversa ainda</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Este card é um lead sem conversa WhatsApp. Quando ele responder pela primeira vez ou
          você enviar uma mensagem pela aba Atendimento, a conversa aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[60vh] flex-col">
      {/* header */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted-foreground truncate">
            {contactName && <span className="font-medium text-foreground">{contactName} · </span>}
            {messages.length} mensagem{messages.length === 1 ? '' : 's'} · tempo real
          </span>
          {isArchived && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">
              <Archive className="h-2.5 w-2.5" />
              Arquivada
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            title={isArchived ? 'Desarquivar conversa' : 'Arquivar conversa'}
            onClick={toggleArchive}
            disabled={archiving}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
              isArchived
                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-950/40 dark:text-orange-400'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {archiving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isArchived ? (
              <ArchiveX className="h-3 w-3" />
            ) : (
              <Archive className="h-3 w-3" />
            )}
            {isArchived ? 'Desarquivar' : 'Arquivar'}
          </button>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} aria-label="Atualizar" title="Atualizar">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* messages list: rola só aqui dentro; avisos por cima não empurram o conteúdo */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={caixaRef}
          onScroll={aoRolar}
          data-testid="caixa-da-conversa"
          className="absolute inset-0 space-y-2 overflow-y-auto [overflow-anchor:none] rounded-lg border bg-muted/30 p-3"
        >
          {erroAnteriores && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span>Não deu pra carregar as anteriores</span>
              <Button variant="link" size="sm" onClick={() => void carregarAnteriores()}>
                Tentar de novo
              </Button>
            </div>
          )}
          {temMais === false && messages.length > 0 && (
            <p className="py-1 text-center text-[10px] text-muted-foreground">Início da conversa</p>
          )}
          {loading && messages.length === 0 && !erro ? (
            <Carregando linhas={3} />
          ) : messages.length === 0 && erro ? (
            <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={() => void load()} />
          ) : messages.length === 0 ? (
            <EmptyState tamanho="compacto" title="Nenhuma mensagem ainda." />
          ) : (
            messages.map(m => {
              // Eventos do sistema (atribuição, mudança de status/etiqueta, etc)
              // não são mensagem de ninguém — iam parar num balão como se o
              // LEAD tivesse escrito "Assigned to X, inherited from...". Vira
              // uma etiqueta central, igual à tela de Conversas.
              if (m.message_type === MESSAGE_TYPE.ACTIVITY || m.message_type === MESSAGE_TYPE.TEMPLATE) {
                return <SystemMessage key={`system-${m.id}`} message={m} />;
              }
              const isOutgoing = m.message_type === MESSAGE_TYPE.OUTGOING;
              const senderName = !isOutgoing
                ? (m.sender?.name && !isPhoneNumber(m.sender.name) ? m.sender.name : contactName)
                : null;
              return (
                <div key={m.id} className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}>
                  {senderName && (
                    <span className="mb-0.5 px-1 text-[10px] text-muted-foreground">{senderName}</span>
                  )}
                  <MessageBubble m={m} isOutgoing={isOutgoing} conversationId={conversationId} />
                </div>
              );
            })
          )}
        </div>
        {carregandoAnteriores && (
          <p className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-background/90 px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm">
            Carregando mensagens anteriores…
          </p>
        )}
        {novaMensagem && (
          <div className="absolute inset-x-0 bottom-2 flex justify-center">
            <Button size="sm" onClick={irProFim}>
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
              Nova mensagem
            </Button>
          </div>
        )}
      </div>

      {/* pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {pendingFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1 rounded border bg-muted px-2 py-1 text-xs">
              <span className="max-w-[6rem] truncate">{f.name}</span>
              <button
                onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                aria-label="Remover anexo"
                title="Remover anexo"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* input area (relative: ancora o popover de funil logo acima, dentro da tela) */}
      <div className="relative mt-2 flex gap-2">
        <div className="flex flex-1 flex-col gap-1 rounded-lg border bg-background px-2 pb-1 pt-1">
          {/* toolbar */}
          <div className="flex gap-0.5">
            <button
              type="button"
              title="Anexar arquivo (imagem, vídeo, áudio)"
              onClick={() => fileInputRef.current?.click()}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Mensagens prontas"
              aria-label="Mensagens prontas"
              onClick={() => setFunnelOpen(v => !v)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Rocket className="h-4 w-4" />
            </button>
            {onAgendarEnvio && (
              <button
                type="button"
                title="Agendar envio"
                aria-label="Agendar envio"
                onClick={() => onAgendarEnvio(text)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Clock className="h-4 w-4" />
              </button>
            )}
          </div>

          <Textarea
            rows={2}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Responder no WhatsApp..."
            className="resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
        </div>

        <Button
          onClick={send}
          disabled={sending || (!text.trim() && pendingFiles.length === 0)}
          size="default"
          aria-label="Enviar"
          title="Enviar"
          className="self-end"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>

        {/* Disparar funil (sprint 4 das Automações): o mesmo painel do campo de
            mensagem das Conversas, ancorado no input (relative acima). */}
        <DispararFunilPanel
          isOpen={funnelOpen}
          onClose={() => setFunnelOpen(false)}
          conversationId={conversationId}
        />
      </div>

      <p className="mt-1 text-[10px] text-muted-foreground">
        Enter envia. Shift+Enter quebra linha.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
        onChange={onFileChange}
      />
    </div>
  );
}
