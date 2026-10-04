import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, MessageCircle, MessagesSquare, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/authStore';
import type { SupportKind } from '@/services/support/supportService';
import type { PassoId } from './roteiro';
import { SUPPORT_OPEN_EVENT, type AlvoSuporte } from './openSupport';
import { useNaoLidos } from './useNaoLidos';
import SupportInicio from './SupportInicio';
import SupportRoteiro from './SupportRoteiro';
import SupportNovoChamado from './SupportNovoChamado';
import SupportMensagens from './SupportMensagens';
import SupportChamadoCliente from './SupportChamadoCliente';

/** Rotas do chat (/conversations e /conversations/:id; /conversations-old não conta). */
const CHAT_ROUTE = /^\/conversations(\/|$)/;
// ⚠️ Canvas do construtor (fluxo, follow-up e funil): o painel lateral do bloco
// tem o "Salvar" no canto inferior direito, onde a bolinha cobria (04/10/2026).
// Herdado do FeedbackWidget. As listas continuam com a bolinha.
const BUILDER_CANVAS_ROUTE = /^\/automations\/(flow-builder|follow-ups|message-funnels)\/[^/]+/;

export const escondeBolinha = (pathname: string): boolean =>
  CHAT_ROUTE.test(pathname) || BUILDER_CANVAS_ROUTE.test(pathname);

type Tela =
  | { nome: 'inicio' }
  | { nome: 'roteiro'; passo: PassoId }
  | { nome: 'novo'; kind: SupportKind; subject?: string; faqTopic?: string; rascunho?: string }
  | { nome: 'mensagens' }
  | { nome: 'chamado'; id: string; recemCriado?: boolean };

const ABA_DA_TELA: Record<Tela['nome'], 'inicio' | 'mensagens'> = {
  inicio: 'inicio',
  roteiro: 'inicio',
  novo: 'inicio',
  mensagens: 'mensagens',
  chamado: 'mensagens',
};

/**
 * Chat de suporte (desde 04/10/2026) — substitui o FeedbackWidget.
 *
 * Bolinha no canto + card com duas abas: Início (roteiro de dúvidas, atalhos)
 * e Mensagens (chamados da pessoa). O card não escurece a tela nem trava o app;
 * no celular ocupa a tela inteira. Fechar e reabrir mantém onde a pessoa estava.
 *
 * Em Conversas a bolinha NÃO é renderizada: ela é fixed no canto e cobria o
 * botão de enviar do MessageInput (decisão de 26/07). Lá o card abre pelo menu
 * do avatar (openSupport). `?suporte=<id>` (link do e-mail) abre direto no chamado.
 */
export default function SupportWidget() {
  const location = useLocation();
  const navigate = useNavigate();
  const nome = useAuthStore(s => s.currentUser?.name ?? '');
  const primeiroNome = nome.trim().split(/\s+/)[0] ?? '';
  const [aberto, setAberto] = useState(false);
  // Depois da primeira abertura o card fica montado (escondido) pra guardar rascunho e tela.
  const [jaAbriu, setJaAbriu] = useState(false);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const [tela, setTela] = useState<Tela>({ nome: 'inicio' });
  const { naoLidos, atualizar } = useNaoLidos();
  const bolinha = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  // Tocar na aba Mensagens sempre recarrega a lista (vira `recarga` do SupportMensagens).
  const [recargaMensagens, setRecargaMensagens] = useState(0);

  const abrir = useCallback((alvo: AlvoSuporte = {}) => {
    if (alvo.chamadoId) setTela({ nome: 'chamado', id: alvo.chamadoId });
    // Guarda quem tinha o foco pra devolver ao fechar (só na transição fechado → aberto).
    if (!card.current || card.current.hasAttribute('inert')) {
      focoAnterior.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    setJaAbriu(true);
    setAberto(true);
  }, []);

  const fechar = () => {
    setAberto(false);
    // "Recebemos!" é só da primeira vez que o chamado abre.
    setTela(t => (t.nome === 'chamado' && t.recemCriado ? { ...t, recemCriado: false } : t));
    const volta = focoAnterior.current?.isConnected ? focoAnterior.current : bolinha.current;
    volta?.focus();
  };

  useEffect(() => {
    const onAbrir = (e: Event) => abrir((e as CustomEvent<AlvoSuporte>).detail ?? {});
    window.addEventListener(SUPPORT_OPEN_EVENT, onAbrir);
    return () => window.removeEventListener(SUPPORT_OPEN_EVENT, onAbrir);
  }, [abrir]);

  // Link do e-mail: abre no chamado e tira o ?suporte= do endereço.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('suporte');
    if (!id) return;
    abrir({ chamadoId: id });
    params.delete('suporte');
    const resto = params.toString();
    navigate({ pathname: location.pathname, search: resto ? `?${resto}` : '' }, { replace: true });
  }, [location.search, location.pathname, navigate, abrir]);

  useEffect(() => {
    if (aberto) card.current?.focus();
  }, [aberto]);

  // Esc no document: o menu do avatar (Radix) devolve o foco ao avatar depois do nosso
  // card.focus(), e o keydown do card nunca recebe a tecla. Vale pra qualquer entrada.
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fecharRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aberto]);

  const aba = ABA_DA_TELA[tela.nome];
  const podeVoltar = tela.nome === 'roteiro' || tela.nome === 'novo' || tela.nome === 'chamado';
  const voltar = () => setTela(aba === 'inicio' ? { nome: 'inicio' } : { nome: 'mensagens' });

  return (
    <>
      {!escondeBolinha(location.pathname) && (
        <button
          ref={bolinha}
          type="button"
          onClick={() => (aberto ? fechar() : abrir())}
          aria-label={naoLidos > 0 && !aberto ? `Abrir ajuda e suporte, ${naoLidos} com resposta nova` : 'Abrir ajuda e suporte'}
          aria-expanded={aberto}
          className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90"
        >
          {aberto ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
          {naoLidos > 0 && !aberto && (
            <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-destructive-foreground">
              {naoLidos}
            </span>
          )}
        </button>
      )}

      {jaAbriu && (
        <div
          ref={card}
          role="dialog"
          aria-label="Ajuda e suporte"
          tabIndex={-1}
          // Fechado = fora da ordem de Tab e dos leitores de tela, mas montado.
          inert={!aberto}
          aria-hidden={!aberto}
          // Mobile: encolhe com o teclado, como o MainLayout (var(--keyboard-inset), 0px com teclado fechado).
          className={cn(
            'fixed inset-x-0 top-0 z-50 flex h-[calc(100dvh-var(--keyboard-inset,0px))] flex-col overflow-hidden bg-background shadow-2xl outline-none sm:inset-auto sm:right-4 sm:bottom-20 sm:h-[600px] sm:max-h-[calc(100vh-6rem)] sm:w-[380px] sm:rounded-2xl sm:border sm:border-border',
            !aberto && 'hidden',
          )}
        >
          <header className="bg-gradient-to-b from-primary to-primary/80 px-5 pb-5 pt-[calc(1rem+env(safe-area-inset-top))] text-primary-foreground sm:pt-4">
            <div className="flex items-center justify-between">
              {podeVoltar ? (
                <button type="button" onClick={voltar} aria-label="Voltar" className="rounded-md p-1 hover:bg-white/10">
                  <ArrowLeft className="h-5 w-5" />
                </button>
              ) : (
                <span />
              )}
              <button type="button" onClick={fechar} aria-label="Fechar" className="rounded-md p-1 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            {tela.nome === 'inicio' && (
              <div className="mt-4">
                <p className="text-2xl font-semibold opacity-80">Olá{primeiroNome ? `, ${primeiroNome}` : ''} 👋</p>
                <p className="text-2xl font-semibold">Como podemos ajudar?</p>
              </div>
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tela.nome === 'inicio' && (
              <SupportInicio
                onPergunta={passo => setTela({ nome: 'roteiro', passo })}
                onChamado={(kind, rascunho) => setTela({ nome: 'novo', kind, rascunho })}
              />
            )}
            {tela.nome === 'roteiro' && (
              <SupportRoteiro
                inicio={tela.passo}
                onInicio={() => setTela({ nome: 'inicio' })}
                onChamado={(kind, origem) => setTela({ nome: 'novo', kind, ...origem })}
              />
            )}
            {tela.nome === 'novo' && (
              <SupportNovoChamado
                kind={tela.kind}
                subject={tela.subject}
                faqTopic={tela.faqTopic}
                rascunho={tela.rascunho}
                onCriado={id => setTela({ nome: 'chamado', id, recemCriado: true })}
              />
            )}
            {tela.nome === 'mensagens' && (
              <SupportMensagens aberto={aberto} recarga={recargaMensagens} onAbrir={id => setTela({ nome: 'chamado', id })} onNovo={() => setTela({ nome: 'novo', kind: 'question' })} />
            )}
            {tela.nome === 'chamado' && (
              <SupportChamadoCliente id={tela.id} recemCriado={tela.recemCriado} aberto={aberto} onLido={() => void atualizar()} />
            )}
          </div>

          <nav role="tablist" className="grid grid-cols-2 border-t border-border pb-[max(0px,env(safe-area-inset-bottom)-var(--keyboard-inset,0px))] sm:pb-0">
            {(
              [
                { chave: 'inicio', rotulo: 'Início', icone: Home, ir: { nome: 'inicio' } as Tela },
                { chave: 'mensagens', rotulo: 'Mensagens', icone: MessagesSquare, ir: { nome: 'mensagens' } as Tela },
              ] as const
            ).map(({ chave, rotulo, icone: Icone, ir }) => (
              <button
                key={chave}
                type="button"
                role="tab"
                aria-selected={aba === chave}
                onClick={() => {
                  setTela(ir);
                  if (chave === 'mensagens') setRecargaMensagens(n => n + 1);
                }}
                className={cn('flex flex-col items-center gap-0.5 py-2.5 text-xs', aba === chave ? 'font-semibold text-primary' : 'text-muted-foreground')}
              >
                <span className="relative">
                  <Icone className="h-5 w-5" aria-hidden="true" />
                  {chave === 'mensagens' && naoLidos > 0 && (
                    <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-destructive">
                      <span className="sr-only">{naoLidos} com resposta nova</span>
                    </span>
                  )}
                </span>
                {rotulo}
              </button>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
