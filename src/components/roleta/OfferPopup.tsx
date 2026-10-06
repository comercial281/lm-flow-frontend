import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Clock, Loader2, X } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import { usePendingOffers } from '@/contexts/PendingOffersContext';
import OfferAiBriefing from './OfferAiBriefing';
import { deadlineLabel, SEM_PRAZO } from './offerDeadline';
import { reasonOf } from './offerReason';
import { destinoDoLead, gravarVistas, lerVistas, ofertasNaoVistas } from './offerPopupState';

// Pop-up de aceite da roleta: abre sobre QUALQUER tela do app quando chega uma
// oferta que o corretor ainda não viu.
//
// Antes a oferta só aparecia na faixa amarela do topo (fácil de não ver) e no
// link do WhatsApp. Com prazo correndo, o lead passava para o próximo enquanto
// o corretor trabalhava em outra tela.
//
// Regras (não reabrir sem o dono pedir):
// - A lista é a do PendingOffersContext (uma só para o app inteiro), que checa
//   a cada 15 s com a aba visível. Sem tempo real até a conexão ao vivo ir para
//   o app inteiro.
// - Aceitar/Recusar são as MESMAS chamadas da tela de aceite (via contexto,
//   igual ao selo do OfferActions). Não existe segunda porta.
// - *Ver depois* (ou fechar) marca a oferta como vista: ela fica na faixa
//   amarela e não reabre aqui. Só oferta nova abre.
// - Várias ofertas: uma por vez, a mais antiga primeiro, com "+N esperando".
// - Não abre na própria tela de aceite (`/roleta/aceite/:id`).

const SOM_DA_OFERTA = '/audio/notifications/ding.mp3';

function tocarSom() {
  try {
    const audio = new Audio(SOM_DA_OFERTA);
    audio.volume = 0.6;
    // Sem permissão de som do navegador (ninguém clicou na página ainda), o
    // play é recusado: o pop-up abre calado.
    void audio.play().catch(() => {});
  } catch {
    /* navegador sem áudio: abre calado */
  }
}

function textoDoPrazo(prazo: string): string {
  if (prazo === SEM_PRAZO) return 'Sem prazo de aceite';
  if (/^\d+ min$/.test(prazo)) return `Aceite em até ${prazo}`;
  return 'Prazo esgotado';
}

export default function OfferPopup() {
  const { offers, accept, refuse, refresh } = usePendingOffers();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [vistas, setVistas] = useState<Set<string>>(() => lerVistas());
  const [acting, setActing] = useState<null | 'accept' | 'refuse'>(null);
  const tocadas = useRef<Set<string>>(new Set());

  const fila = ofertasNaoVistas(offers, vistas);
  const atual = fila[0];
  const naTelaDeAceite = pathname.startsWith('/roleta/aceite/');
  const aberto = !!atual && !naTelaDeAceite;

  // Som curto uma vez por oferta, quando ela aparece no pop-up.
  useEffect(() => {
    if (!aberto || !atual || tocadas.current.has(atual.id)) return;
    tocadas.current.add(atual.id);
    tocarSom();
  }, [aberto, atual]);

  function verDepois() {
    if (!atual) return;
    const proximas = new Set(vistas);
    proximas.add(atual.id);
    gravarVistas(proximas);
    setVistas(proximas);
  }

  async function onAccept() {
    if (!atual) return;
    setActing('accept');
    try {
      const result = await accept(atual.id);
      toast.success('Lead aceito! Ele é seu.');
      navigate(destinoDoLead({ ...atual, ...result }));
    } catch (err) {
      toast.error(reasonOf(err, 'Não foi possível aceitar.'));
      void refresh();
    } finally {
      setActing(null);
    }
  }

  async function onRefuse() {
    if (!atual) return;
    setActing('refuse');
    try {
      await refuse(atual.id);
      toast.info('Lead recusado. Passamos para o próximo corretor.');
    } catch (err) {
      toast.error(reasonOf(err, 'Não foi possível recusar.'));
      void refresh();
    } finally {
      setActing(null);
    }
  }

  if (!atual) return null;

  const esperando = fila.length - 1;
  const prazo = deadlineLabel(atual);

  return (
    <Dialog open={aberto} onOpenChange={abrir => { if (!abrir) verDepois(); }}>
      {/* No celular (abaixo de 640 px) o pop-up ocupa a tela inteira. */}
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0">
        <DialogHeader>
          <DialogTitle>Lead novo pra você</DialogTitle>
          <DialogDescription>
            {esperando > 0 ? `+${esperando} esperando` : 'A roleta ofertou este lead a você.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            prazo === 'prazo esgotado'
              ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'
              : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
          }`}>
            <Clock className="h-4 w-4 shrink-0" />
            {textoDoPrazo(prazo)}
          </div>

          <div className="space-y-1">
            <p className="break-words text-lg font-semibold">{atual.lead_name}</p>
            {atual.origin_label && (
              <p className="break-words text-sm text-muted-foreground">
                Origem: <span className="text-foreground">{atual.origin_label}</span>
              </p>
            )}
            {atual.roleta_name && (
              <p className="break-words text-sm text-muted-foreground">
                Roleta: <span className="text-foreground">{atual.roleta_name}</span>
              </p>
            )}
          </div>

          {/* O bloco da IA foi desenhado para o fundo escuro da tela de aceite
              (texto branco): aqui ele ganha o mesmo fundo, nos dois temas. */}
          {atual.ia_briefing && (
            <div className="rounded-xl bg-[#1A0A2E] [&>div]:mb-0">
              <OfferAiBriefing briefing={atual.ia_briefing} />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onRefuse} disabled={!!acting} className="gap-1.5">
              {acting === 'refuse' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Recusar
            </Button>
            <Button onClick={onAccept} disabled={!!acting} className="gap-1.5">
              {acting === 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Aceitar
            </Button>
          </div>
          <Button variant="ghost" onClick={verDepois} disabled={!!acting}>
            Ver depois
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
