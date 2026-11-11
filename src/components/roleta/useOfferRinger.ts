import { useEffect } from 'react';
import { isRingLeader, playLeadAlert } from '@/lib/plantaoSound/leadAlert';

// Som do Plantão (11/11/2026): a oferta da roleta toca o Chegou na hora e repete
// de 10 em 10 s até o corretor aceitar, recusar, clicar em "Ver depois" ou o
// prazo vencer. Quem decide se está tocando é o pop-up (`ringing`); o prazo vem
// junto porque o pop-up só se redesenha quando a lista de ofertas chega (15 s),
// e o som não pode passar do prazo esperando por ela.
//
// Só a aba líder toca (ver leadAlert.ts). A pergunta é feita a cada toque: a
// aba que vira líder no meio (a outra foi fechada) assume no ciclo seguinte.
export const RING_MS = 10_000;

export function useOfferRinger(ringing: boolean, deadlineMs: number | null = null): void {
  useEffect(() => {
    if (!ringing) return;
    if (deadlineMs != null && Date.now() >= deadlineMs) return;

    let id: ReturnType<typeof setInterval> | undefined;
    const tocar = () => {
      if (deadlineMs != null && Date.now() >= deadlineMs) {
        if (id) clearInterval(id);
        return;
      }
      if (isRingLeader()) void playLeadAlert();
    };
    tocar();
    id = setInterval(tocar, RING_MS);
    return () => clearInterval(id);
  }, [ringing, deadlineMs]);
}
