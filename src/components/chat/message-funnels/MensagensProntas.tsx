import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Clock, Eye, FileText, Image as ImageIcon, Loader2, MessageSquare, Mic, Rocket, Search, Send, X, Zap,
  type LucideIcon,
} from 'lucide-react';
import { Button, Input } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import IconActionButton from '@/components/base/IconActionButton';
import { PreviewStepLine } from '@/components/flowAutomations/FunnelTemplatePicker';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import { flowAutomationInstancesService } from '@/services/flowAutomations/flowAutomationInstancesService';
import type { FlowAutomation } from '@/types/flowAutomations';
import type { FlowTemplatePreviewStep } from '@/features/flowAutomations/templates';
import { FLOW_KIND_COPY } from '@/features/flowAutomations/kind';
import { funnelPreview } from '@/features/flowAutomations/funnelPreview';
import { serverMessage } from '@/features/flowAutomations/guide';
import {
  TIPOS_PRONTOS, itemPronto, resumoDoFunil, type ItemPronto, type TipoPronto,
} from '@/features/flowAutomations/mensagensProntas';
import { cn } from '@/lib/utils';

// MENSAGENS PRONTAS da conversa (12/10/2026, modelo Zap Voice). O que era o
// "Disparar funil": os funis de conversa separados por tipo (Mensagens, Áudios,
// Mídias, Funis), cada um com Ver (a prévia abre ali mesmo, embaixo do item) e
// Enviar na própria linha. O envio roda NO SERVIDOR, pelo número da conversa
// (`POST /flow_automation_instances/start`), igual ao disparo de antes.
//
// Mora em dois lugares: na lateral da conversa (tela de computador, no lugar do
// painel do lead) e na janela em cima do campo (celular e aba Conversa do card).
// Funil com passo do guia pendente não envia: aparece com "Termine de montar".

const TONS: Record<TipoPronto, string> = {
  mensagem: 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
  audio: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  midia: 'bg-pink-100 text-pink-600 dark:bg-pink-950/60 dark:text-pink-400',
  funil: 'bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
};
const ICONES: Record<TipoPronto, LucideIcon> = { mensagem: MessageSquare, audio: Mic, midia: ImageIcon, funil: Rocket };

type FiltroTipo = 'todos' | TipoPronto;

interface Props {
  /** Carrega a lista quando abre (e de novo a cada abertura). */
  ativo: boolean;
  conversationId?: string | number | null;
  /** Depois de enviar: relê a faixa "automação rodando". */
  onStarted?: () => void;
  aoFechar: () => void;
  /** Lateral: "Voltar pro lead" no topo e fica aberta depois de enviar. Janela: fecha ao enviar. */
  onde: 'lateral' | 'janela';
  aoVoltar?: () => void;
  /**
   * A conversa não aceita envio agora (pendente, em oferta, número
   * desconectado, janela de 24 h fechada): a mesma trava do foguete. A
   * lateral fica aberta ao trocar de conversa, então precisa saber disso.
   */
  bloqueado?: boolean;
}

export function MensagensProntas({ ativo, conversationId, onStarted, aoFechar, onde, aoVoltar, bloqueado = false }: Props) {
  const navigate = useNavigate();
  const raiz = useRef<HTMLDivElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);
  // A conversa de agora: o envio que volta depois da troca não fala "este lead" do lead errado.
  const conversaAtual = useRef(conversationId);
  conversaAtual.current = conversationId;
  const [itens, setItens] = useState<ItemPronto[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<FiltroTipo>('todos');
  const [aberto, setAberto] = useState<string | null>(null);
  // Prévia buscada na hora (lista sem os blocos): id do funil → passos.
  const [buscadas, setBuscadas] = useState<Record<string, FlowTemplatePreviewStep[]>>({});
  const [enviando, setEnviando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setFalhou(false);
    setItens(null);
    try {
      const lista = await flowAutomationsService.list({ kind: 'conversation', withNodes: true });
      setItens(lista.filter(f => !f.archived_at).map(itemPronto));
    } catch {
      setFalhou(true);
    }
  }, []);

  // Cada abertura começa limpa e com o cursor na busca (a lateral fica montada:
  // o autoFocus só valeria na primeira vez).
  useEffect(() => {
    if (!ativo) return;
    setAberto(null);
    setBusca('');
    setTipo('todos');
    campoBusca.current?.focus();
    void carregar();
  }, [ativo, carregar]);

  // Trocou de conversa no meio de um envio: o botão destrava na conversa nova.
  useEffect(() => { setEnviando(null); }, [conversationId]);

  // Esc fecha a prévia aberta; sem prévia, fecha o painel. Na lateral (que fica
  // aberta enquanto se conversa) só com o cursor dentro dela: o Esc de outra
  // janela, do emoji ou do campo de mensagem não é pra cá.
  useEffect(() => {
    if (!ativo) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
      if (onde === 'lateral' && !raiz.current?.contains(document.activeElement)) return;
      if (aberto) setAberto(null);
      else aoFechar();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ativo, aberto, aoFechar, onde]);

  const todos = itens ?? [];
  const tiposComItem = TIPOS_PRONTOS.filter(t => todos.some(i => i.tipo === t.tipo));
  // Filtro escolhido que deixou de existir na tela (o seletor some) não filtra escondido.
  const tipoValendo: FiltroTipo = tiposComItem.length > 1 && tiposComItem.some(t => t.tipo === tipo) ? tipo : 'todos';

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return todos.filter(i =>
      (!termo || i.funil.name.toLowerCase().includes(termo)) &&
      (tipoValendo === 'todos' || i.tipo === tipoValendo));
  }, [todos, busca, tipoValendo]);

  const filtrando = Boolean(busca.trim()) || tipoValendo !== 'todos';
  const limparFiltros = () => { setBusca(''); setTipo('todos'); };

  const verOuEsconder = async (item: ItemPronto) => {
    const id = item.funil.id;
    if (aberto === id) { setAberto(null); return; }
    setAberto(id);
    if (item.passos || buscadas[id]) return;
    try {
      const fluxo = await flowAutomationsService.get(id);
      setBuscadas(atual => ({ ...atual, [id]: funnelPreview(fluxo) }));
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra abrir a prévia. Tente de novo.'));
      setAberto(atual => (atual === id ? null : atual));
    }
  };

  const enviar = async (funil: FlowAutomation) => {
    if (!conversationId || enviando || bloqueado) return;
    const conversa = conversationId;
    setEnviando(funil.id);
    try {
      const r = await flowAutomationInstancesService.start({ conversationId: String(conversa) }, funil.id);
      const mesmaConversa = String(conversaAtual.current) === String(conversa);
      if (!mesmaConversa) toast.success(`"${funil.name}" enviado pro lead da conversa anterior.`);
      else if (r.started) toast.success(r.message || `"${funil.name}" enviado pra este lead.`);
      else toast.info(r.message || `Este lead já está em "${funil.name}".`);
      if (mesmaConversa) onStarted?.();
      if (onde === 'janela') aoFechar();
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra enviar agora. Tente de novo.'));
    } finally {
      setEnviando(null);
    }
  };

  const abrirCanvas = (f: FlowAutomation) => {
    aoFechar();
    navigate(`${FLOW_KIND_COPY.conversation.listPath}/${f.id}`);
  };

  const linha = (item: ItemPronto) => (
    <LinhaPronta
      key={item.funil.id}
      item={item}
      passos={item.passos ?? buscadas[item.funil.id] ?? null}
      aberto={aberto === item.funil.id}
      enviando={enviando === item.funil.id}
      podeEnviar={Boolean(conversationId) && !enviando && !bloqueado}
      aoVer={() => void verOuEsconder(item)}
      aoEnviar={() => void enviar(item.funil)}
      aoTerminar={() => abrirCanvas(item.funil)}
    />
  );

  return (
    // flex-1 (e não h-full): na janela a altura acompanha o conteúdo até o teto.
    <div ref={raiz} className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {onde === 'lateral' && aoVoltar ? (
          <IconActionButton
            label="Voltar pro lead"
            icon={<ArrowLeft className="h-4 w-4" />}
            variant="ghost"
            className="h-8 w-8"
            onClick={aoVoltar}
          />
        ) : (
          <Rocket className="h-4 w-4 text-primary" aria-hidden="true" />
        )}
        <h2 className="flex-1 truncate text-sm font-semibold">Mensagens prontas</h2>
        <IconActionButton label="Fechar" icon={<X className="h-4 w-4" />} variant="ghost" className="h-8 w-8" onClick={aoFechar} />
      </div>

      <div className="space-y-2 px-3 pt-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            className="pl-8"
            placeholder="Buscar..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            aria-label="Buscar mensagem pronta"
            ref={campoBusca}
          />
        </div>
        {tiposComItem.length > 1 && (
          <BotoesDeEscolha<FiltroTipo>
            rotulo="Tipo"
            valor={tipoValendo}
            aoEscolher={setTipo}
            opcoes={[{ valor: 'todos', rotulo: 'Tudo' }, ...tiposComItem.map(t => ({ valor: t.tipo, rotulo: t.rotulo }))]}
            className="w-full"
          />
        )}
        {bloqueado && (
          <Aviso tom="atencao" compacto>
            Nesta conversa não dá pra enviar agora. Assuma o lead ou confira o número.
          </Aviso>
        )}
      </div>

      {/* Na lateral, folga à direita: a aba "?" do suporte fica na borda da tela. */}
      <div className={cn('flex-1 min-h-0 overflow-y-auto py-2 scrollbar-thin', onde === 'lateral' ? 'pl-2 pr-7' : 'px-2')}>
        {falhou ? (
          <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={() => void carregar()} />
        ) : !itens ? (
          <Carregando linhas={4} className="px-2" rotulo="Carregando as mensagens prontas…" />
        ) : todos.length === 0 ? (
          <EmptyState
            tamanho="compacto"
            icon={Rocket}
            title="Nenhuma mensagem pronta ainda"
            description="Crie a sua em Funis de mensagem, a partir de um modelo pronto."
            exemplo="Mandar o book do imóvel com uma frase de abertura, num clique."
            action={{ label: 'Abrir Funis de mensagem', onClick: () => { aoFechar(); navigate(FLOW_KIND_COPY.conversation.listPath); }, variant: 'outline' }}
          />
        ) : visiveis.length === 0 ? (
          <EmptyState tipo="semResultado" tamanho="compacto" aoLimparFiltros={filtrando ? limparFiltros : undefined} />
        ) : tipoValendo !== 'todos' ? (
          <ul className="space-y-0.5">{visiveis.map(linha)}</ul>
        ) : (
          TIPOS_PRONTOS.map(({ tipo: t, rotulo }) => {
            const doTipo = visiveis.filter(i => i.tipo === t);
            if (doTipo.length === 0) return null;
            const Icone = ICONES[t];
            return (
              <section key={t} aria-label={rotulo} className="mb-2">
                <h3 className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span aria-hidden className={cn('inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px]', TONS[t])}>
                    <Icone className="h-3 w-3" />
                  </span>
                  {rotulo}
                </h3>
                <ul className="space-y-0.5">{doTipo.map(linha)}</ul>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

const ICONE_DO_PASSO: Record<string, LucideIcon> = { audio: Mic, image: ImageIcon, video: ImageIcon, document: FileText, sticker: ImageIcon };

/** Os ícones da sequência (💬 ⏱ 🎤…), no máximo 6. */
function IconesDaSequencia({ passos }: { passos: FlowTemplatePreviewStep[] }) {
  const mostrar = passos.slice(0, 6);
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center gap-0.5">
      {mostrar.map((p, i) => {
        const Icone = p.kind === 'wait' ? Clock : p.kind === 'other' ? Zap : (p.media_kind && ICONE_DO_PASSO[p.media_kind]) || MessageSquare;
        return <Icone key={i} className="h-3 w-3" />;
      })}
      {passos.length > mostrar.length && <span>…</span>}
    </span>
  );
}

/** A linha de baixo do item: o texto da mensagem, o tipo da mídia ou o resumo do funil. */
function Subtitulo({ item, passos }: { item: ItemPronto; passos: FlowTemplatePreviewStep[] | null }) {
  const { funil, tipo } = item;
  const pendente = (funil.guide_pending ?? []).length > 0;
  if (pendente) return <span className="block truncate text-amber-700 dark:text-amber-300">Falta terminar o passo a passo</span>;
  if (!funil.is_enabled) return <span className="block truncate">Desligado: ligue em Funis de mensagem</span>;
  const equipe = funil.team ? <span className="min-w-0 truncate">· Da equipe</span> : null;
  if (tipo === 'funil') {
    return (
      <span className="flex items-center gap-1.5">
        {passos && <IconesDaSequencia passos={passos} />}
        <span className="shrink-0 whitespace-nowrap">{resumoDoFunil(passos, funil.message_count)}</span>
        {equipe}
      </span>
    );
  }
  const passo = passos?.[0];
  const texto = passo?.text?.split('\n')[0]?.trim();
  const midia = tipo === 'audio' ? 'Áudio' : tipo === 'midia' ? (passo?.media_source ? 'Book do imóvel' : 'Mídia') : '';
  return (
    <span className="flex items-center gap-1">
      <span className="min-w-0 truncate">{texto || midia || 'Mensagem'}</span>
      {equipe}
    </span>
  );
}

interface LinhaProps {
  item: ItemPronto;
  passos: FlowTemplatePreviewStep[] | null;
  aberto: boolean;
  enviando: boolean;
  podeEnviar: boolean;
  aoVer: () => void;
  aoEnviar: () => void;
  aoTerminar: () => void;
}

function LinhaPronta({ item, passos, aberto, enviando, podeEnviar, aoVer, aoEnviar, aoTerminar }: LinhaProps) {
  const { funil, tipo } = item;
  const pendente = (funil.guide_pending ?? []).length > 0;
  const desligado = !pendente && !funil.is_enabled;
  const Icone = ICONES[tipo];

  return (
    <li>
      <div className={cn('group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60', desligado && 'opacity-60')}>
        <span aria-hidden className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', TONS[tipo])}>
          <Icone className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{funil.name}</p>
          <div className="text-xs text-muted-foreground">
            <Subtitulo item={item} passos={passos} />
          </div>
        </div>
        {pendente ? (
          <Button size="sm" variant="outline" onClick={aoTerminar}>Termine de montar</Button>
        ) : !desligado && (
          // Ações à vista (peça da casa): apagadas, acendem no mouse.
          <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <IconActionButton
              label={aberto ? `Esconder "${funil.name}"` : `Ver "${funil.name}"`}
              icon={<Eye className="h-4 w-4" />}
              variant="ghost"
              className={cn('h-8 w-8', aberto && 'bg-muted text-primary')}
              onClick={aoVer}
            />
            <IconActionButton
              label={`Enviar "${funil.name}"`}
              icon={enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              variant="ghost"
              className="h-8 w-8 text-primary"
              disabled={!podeEnviar}
              onClick={aoEnviar}
            />
          </div>
        )}
      </div>

      {/* A prévia desce dentro do item (grid de 0fr → 1fr anima a altura). */}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
          aberto ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
        aria-hidden={!aberto}
      >
        <div className="min-h-0 overflow-hidden">
          {/* Com a sequência já conhecida, fica montada fechada: a volta também anima. */}
          {(aberto || passos) && (
            <div className="ml-[2.875rem] mr-2 pb-2 pt-1">
              {passos ? (
                <>
                  <ol className="space-y-1.5" aria-label="Sequência do funil">
                    {passos.map((p, i) => <PreviewStepLine key={i} step={p} />)}
                  </ol>
                  {tipo === 'funil' && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Sai pelo número desta conversa e continua mesmo se você fechar a tela. Dá pra parar na faixa acima do campo de mensagem.
                    </p>
                  )}
                </>
              ) : (
                <Carregando variante="texto" linhas={2} rotulo="Carregando a sequência…" />
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
