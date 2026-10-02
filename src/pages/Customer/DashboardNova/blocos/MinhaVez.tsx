// src/pages/Customer/DashboardNova/blocos/MinhaVez.tsx
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { numero, plural } from '@/lib/formato';
import { IconActionButton } from '@/components/base';
import { GlassCard } from '../base/primitives';
import { brokerAssignmentsService, type QueuePosition } from '@/services/roletaConfig/brokerAssignmentsService';
import { usePendingOffers } from '@/contexts/PendingOffersContext';
import type { ContextoBloco } from '../usePodeAbrir';

const INTERVALO_MS = 120_000;
/** Quanto o dedo precisa andar para trocar de roleta. Menos que isso é toque. */
const ARRASTE_MIN_PX = 40;

const texto = (r: QueuePosition) => {
  if (r.com_oferta) return 'Você está com um lead esperando seu aceite.';
  if (r.situacao === 'pausado') return 'Você está pausado nesta roleta. Fale com o gestor para voltar à fila.';
  if (r.situacao === 'fora') return 'Você está fora desta fila agora. Fale com o gestor.';
  if (r.posicao === 1) return 'Você é o próximo a receber.';
  return `${plural((r.posicao ?? 1) - 1, 'corretor', 'corretores')} na sua frente.`;
};

/**
 * SUA VEZ NA FILA: a posição do corretor em cada roleta em modo Fila. Só a dele,
 * nunca a fila com o nome dos colegas (essa é o *Roleta agora* do gestor).
 *
 * Busca o próprio dado a cada 2 minutos, só com a aba visível, e na hora em que
 * uma oferta dele chega ou sai (é quando a fila anda para ele). Sem roleta Fila,
 * ou contra o servidor antigo, o cartão não aparece.
 *
 * Mais de uma roleta: um cartão só, com as setas embaixo e arrastando para o lado.
 */
export const MinhaVez: React.FC<ContextoBloco> = ({ visao }) => {
  const ativo = visao === 'corretor';
  const { offers } = usePendingOffers();
  const ofertas = offers.map(o => o.id).join(',');
  const [linhas, setLinhas] = useState<QueuePosition[] | null>(null);
  // Guardada pelo id: se a lista mudar de ordem na próxima volta, a tela não pula.
  const [posicao, setPosicao] = useState<{ id: string | null; indice: number }>({ id: null, indice: 0 });
  const inicioX = useRef<number | null>(null);

  useEffect(() => {
    if (!ativo) return undefined;
    let vivo = true;
    let pedido = 0;
    let timer: ReturnType<typeof setInterval> | undefined;

    const carregar = async () => {
      const meu = ++pedido;
      try {
        const resposta = await brokerAssignmentsService.queuePosition();
        if (vivo && meu === pedido) setLinhas(resposta);
      } catch {
        // Falha momentânea (ou servidor antigo): mantém o que estava e tenta na próxima volta.
      }
    };
    const parar = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const conferirAba = () => {
      parar();
      if (document.visibilityState !== 'visible') return;
      carregar();
      timer = setInterval(carregar, INTERVALO_MS);
    };

    conferirAba();
    document.addEventListener('visibilitychange', conferirAba);
    return () => {
      vivo = false;
      parar();
      document.removeEventListener('visibilitychange', conferirAba);
    };
  }, [ativo, ofertas]);

  if (!ativo || !linhas || linhas.length === 0) return null;

  const achado = linhas.findIndex(r => r.roleta_id === posicao.id);
  const indice = achado >= 0 ? achado : Math.min(posicao.indice, linhas.length - 1);
  const atual = linhas[indice];
  const varias = linhas.length > 1;
  const irPara = (i: number) => {
    if (i < 0 || i >= linhas.length) return;
    setPosicao({ id: linhas[i].roleta_id, indice: i });
  };

  const soltar = (x: number) => {
    const ini = inicioX.current;
    inicioX.current = null;
    if (ini === null || !varias) return;
    const andou = x - ini;
    if (Math.abs(andou) < ARRASTE_MIN_PX) return;
    irPara(andou < 0 ? indice + 1 : indice - 1);
  };

  const setas = varias ? (
    <div className="lmfn-carrossel">
      <IconActionButton
        label="Roleta anterior"
        icon={<ChevronLeft size={14} aria-hidden />}
        disabled={indice === 0}
        onClick={() => irPara(indice - 1)}
      />
      <span className="lmf-card-sub" style={{ margin: 0 }}>{`${numero(indice + 1)} de ${numero(linhas.length)}`}</span>
      <IconActionButton
        label="Próxima roleta"
        icon={<ChevronRight size={14} aria-hidden />}
        disabled={indice >= linhas.length - 1}
        onClick={() => irPara(indice + 1)}
      />
    </div>
  ) : undefined;

  const mostraNumero = atual.situacao === 'na_fila' && !atual.com_oferta && atual.posicao !== null;

  return (
    <GlassCard title="Sua vez na fila" className="lmfn-vez-card" bodyClassName="lmfn-vez-corpo">
      <div
        className="lmfn-vez"
        data-testid="minha-vez-arraste"
        onPointerDown={e => { inicioX.current = e.clientX; }}
        onPointerUp={e => soltar(e.clientX)}
        onPointerCancel={() => { inicioX.current = null; }}
      >
        <div className="lmfn-vez-centro">
          <p className="lmfn-vez-roleta">{atual.roleta_nome}</p>
          {mostraNumero && (
            <p className="lmfn-vez-numero">
              <strong>{`${numero(atual.posicao)}º`}</strong>
              <span>{`de ${numero(atual.total)} na fila`}</span>
            </p>
          )}
          <p className="lmfn-vez-texto">{texto(atual)}</p>
        </div>
        {setas}
      </div>
    </GlassCard>
  );
};
