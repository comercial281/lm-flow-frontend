import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Rocket, Search, Send, Users, X } from 'lucide-react';
import { Card, CardContent } from '@evoapi/design-system/card';
import { Button, Input } from '@/components/ui/ds';
import Abas from '@/components/base/Abas';
import IconActionButton from '@/components/base/IconActionButton';
import { PreviewStepLine } from '@/components/flowAutomations/FunnelTemplatePicker';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import { flowAutomationInstancesService } from '@/services/flowAutomations/flowAutomationInstancesService';
import type { FlowAutomation } from '@/types/flowAutomations';
import { FLOW_KIND_COPY } from '@/features/flowAutomations/kind';
import { funnelPreview } from '@/features/flowAutomations/funnelPreview';
import { serverMessage } from '@/features/flowAutomations/guide';
import { cn } from '@/lib/utils';

// "DISPARAR FUNIL" no campo de mensagem (Automações · sprint 4, estilo Leona).
//
// Substitui o quadradinho de funis antigo. Busca no topo, abas Meus funis e Da
// equipe com o nome grande; clicar num funil mostra a PRÉVIA (cada mensagem e
// espera, em ordem) e o botão Disparar. O disparo roda NO SERVIDOR
// (`POST /flow_automation_instances/start` com a conversa): começa na hora, as
// mensagens saem pelo número da conversa e continuam com a tela fechada. A
// faixa acima do campo mostra o funil rodando, com Parar.
//
// Funil com passo do guia pendente não dispara: aparece com "Termine de montar",
// que leva pro canvas dele.

type Aba = 'meus' | 'equipe';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string | number | null;
  /** Depois de disparar: relê a faixa "automação rodando". */
  onStarted?: () => void;
}

export function DispararFunilPanel({ isOpen, onClose, conversationId, onStarted }: Props) {
  const navigate = useNavigate();
  const [funnels, setFunnels] = useState<FlowAutomation[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [aba, setAba] = useState<Aba>('meus');
  const [chosen, setChosen] = useState<FlowAutomation | null>(null);
  const [detail, setDetail] = useState<FlowAutomation | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const list = (await flowAutomationsService.list({ kind: 'conversation' })).filter(f => !f.archived_at);
      setFunnels(list);
      // Sem funil próprio e com funil da equipe, abre direto na equipe (o corretor recém-chegado).
      setAba(list.some(f => !f.team) || !list.some(f => f.team) ? 'meus' : 'equipe');
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setChosen(null);
    setDetail(null);
    setSearch('');
    void load();
  }, [isOpen, load]);

  // Esc fecha (ou volta da prévia pra lista).
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (chosen) setChosen(null);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, chosen, onClose]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (funnels ?? []).filter(f => !term || f.name.toLowerCase().includes(term));
  }, [funnels, search]);
  const mine = visible.filter(f => !f.team);
  const team = visible.filter(f => f.team);
  const shown = aba === 'meus' ? mine : team;

  const choose = async (f: FlowAutomation) => {
    setChosen(f);
    setDetail(null);
    setLoadingDetail(true);
    try {
      setDetail(await flowAutomationsService.get(f.id));
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra abrir o funil. Tente de novo.'));
      setChosen(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const dispatch = async () => {
    if (!chosen || !conversationId || starting) return;
    setStarting(true);
    try {
      const r = await flowAutomationInstancesService.start({ conversationId: String(conversationId) }, chosen.id);
      if (r.started) toast.success(r.message || `"${chosen.name}" disparado pra este lead.`);
      else toast.info(r.message || `Este lead já está em "${chosen.name}".`);
      onStarted?.();
      onClose();
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra disparar agora. Tente de novo.'));
    } finally {
      setStarting(false);
    }
  };

  const openCanvas = (f: FlowAutomation) => {
    onClose();
    navigate(`${FLOW_KIND_COPY.conversation.listPath}/${f.id}`);
  };

  if (!isOpen) return null;

  const pendingOf = (f: FlowAutomation) => (f.guide_pending ?? []).length > 0;
  const steps = detail ? funnelPreview(detail) : [];

  return (
    <Card
      className="absolute bottom-full left-0 right-0 mb-2 shadow-lg border-border z-50 animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
      role="dialog"
      aria-label="Disparar funil"
      data-testid="painel-disparar-funil"
    >
      <CardContent className="p-0 flex flex-col max-h-[min(70vh,32rem)]">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          {chosen ? (
            <IconActionButton
              label="Voltar pra lista"
              icon={<ArrowLeft className="h-4 w-4" />}
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setChosen(null)}
            />
          ) : (
            <Rocket className="h-4 w-4 text-primary" aria-hidden="true" />
          )}
          <h2 className="flex-1 truncate text-sm font-semibold">{chosen ? chosen.name : 'Disparar funil'}</h2>
          <IconActionButton
            label="Fechar"
            icon={<X className="h-4 w-4" />}
            variant="ghost"
            className="h-8 w-8"
            onClick={onClose}
          />
        </div>

        {!chosen && (
          <>
            <div className="px-3 pt-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  className="pl-8"
                  placeholder="Buscar funil..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  aria-label="Buscar funil"
                  autoFocus
                />
              </div>
            </div>
            <Abas
              rotulo="Funis"
              ativa={aba}
              aoTrocar={chave => setAba(chave as Aba)}
              abas={[
                { chave: 'meus', rotulo: `Meus funis (${mine.length})` },
                { chave: 'equipe', rotulo: `Da equipe (${team.length})`, icone: Users },
              ]}
              className="px-3 mt-2"
            />
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {failed && (
                <p className="px-2 py-4 text-sm text-muted-foreground">
                  Não deu pra carregar os funis.{' '}
                  <button type="button" className="underline" onClick={() => void load()}>Tentar de novo</button>
                </p>
              )}
              {!failed && !funnels && (
                <p className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando os funis…
                </p>
              )}
              {funnels && shown.length === 0 && (
                <p className="px-2 py-4 text-sm text-muted-foreground">
                  {search
                    ? 'Nenhum funil com esse nome.'
                    : aba === 'meus'
                      ? 'Você ainda não tem funil. Crie o seu em Funis de mensagem, a partir de um modelo pronto.'
                      : 'Nenhum funil da equipe ainda.'}
                </p>
              )}
              <ul className="space-y-1">
                {shown.map(f => {
                  const pending = pendingOf(f);
                  const off = !pending && !f.is_enabled;
                  return (
                    <li key={f.id}>
                      {pending ? (
                        <div className="flex items-center gap-2 rounded-md px-2 py-2">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-base font-semibold text-muted-foreground">{f.name}</span>
                            <span className="block text-xs text-amber-700 dark:text-amber-300">Falta terminar o passo a passo</span>
                          </span>
                          <Button size="sm" variant="outline" onClick={() => openCanvas(f)}>Termine de montar</Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void choose(f)}
                          disabled={off}
                          className={cn(
                            'w-full rounded-md px-2 py-2 text-left transition-colors',
                            off ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted',
                          )}
                        >
                          <span className="block truncate text-base font-semibold">{f.name}</span>
                          {off && <span className="block text-xs text-muted-foreground">Desligado: ligue em Funis de mensagem</span>}
                          {!off && f.team && f.owner_name && <span className="block text-xs text-muted-foreground">De {f.owner_name}</span>}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}

        {chosen && (
          <>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {loadingDetail && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando a sequência…
                </p>
              )}
              {detail && (
                <>
                  <p className="mb-2 text-xs text-muted-foreground">O que vai sair pra este lead, nesta ordem:</p>
                  <ol className="space-y-1.5" aria-label="Sequência do funil">
                    {steps.map((st, i) => <PreviewStepLine key={i} step={st} />)}
                  </ol>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Sai pelo número desta conversa e continua mesmo se você fechar a tela. Dá pra parar na faixa acima do
                    campo de mensagem.
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
              <Button variant="outline" size="sm" onClick={() => setChosen(null)}>Voltar</Button>
              <Button size="sm" onClick={() => void dispatch()} disabled={!detail || starting || !conversationId}>
                {starting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4 mr-1" aria-hidden="true" />}
                Disparar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
