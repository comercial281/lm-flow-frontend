// ── SALA DE DEMONSTRAÇÃO (/sala-demonstracao) ────────────────────────────────
//
// Tela escondida: só aparece no espaço de demonstração. Quem pode abrir o
// servidor decide (403 vira a tela de sem acesso; 404 é fora do espaço de
// demonstração). Três estados: sem sessão (Preparar), sessão esperando o lead
// (QR) e sessão no ar (conversa à esquerda; bastidores e follow-up à direita).
// Enquanto há sessão, relê o estado a cada 3 s e também quando chega o evento
// 'lmflow:realtime' (espera de 500 ms para juntar rajadas). Só a resposta do
// pedido mais recente vale: uma consulta velha que chega atrasada é descartada.
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Pagina, BaseHeader, EmptyState, Carregando } from '@/components/base';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import NoAccessState from '@/components/permissions/NoAccessState';
import { demoRoomService } from '@/services/demoRoom/demoRoomService';
import { isForbiddenError } from '@/services/core/forbidden';
import type { DemoRoomState } from '@/types/demoRoom';
import Preparar from './Preparar';
import QrDaSala from './QrDaSala';
import ConversaAoVivo from './ConversaAoVivo';
import Bastidores from './Bastidores';
import FollowupDaSala from './FollowupDaSala';

const CONSULTA_A_CADA_MS = 3000;
const ESPERA_DO_EVENTO_MS = 500;

type Carga = 'carregando' | 'ok' | 'semAcesso' | 'foraDaDemo' | 'erro';

function status404(e: unknown): boolean {
  return (e as { response?: { status?: number } } | null)?.response?.status === 404;
}

function mensagemDe(e: unknown, padrao: string): string {
  return e instanceof Error && e.message ? e.message : padrao;
}

export default function SalaDemonstracao() {
  const [estado, setEstado] = useState<DemoRoomState | null>(null);
  const [carga, setCarga] = useState<Carga>('carregando');
  const vivo = useRef(true);
  const [leitura, setLeitura] = useState(0);
  // Número do último pedido feito: resposta de pedido mais antigo é ignorada.
  const ultimoPedido = useRef(0);

  const carregar = useCallback(async (silencioso: boolean) => {
    const pedido = ++ultimoPedido.current;
    try {
      const novo = await demoRoomService.get();
      if (!vivo.current || pedido !== ultimoPedido.current) return;
      setEstado(novo);
      setCarga('ok');
      setLeitura(n => n + 1);
    } catch (e) {
      if (!vivo.current || pedido !== ultimoPedido.current) return;
      if (isForbiddenError(e)) { setCarga('semAcesso'); return; }
      if (status404(e)) { setCarga('foraDaDemo'); return; }
      // Consulta de fundo que falha não derruba a tela: mantém o último estado.
      if (!silencioso) setCarga('erro');
    }
  }, []);

  useEffect(() => {
    vivo.current = true;
    void carregar(false);
    return () => { vivo.current = false; };
  }, [carregar]);

  const temSessao = !!estado?.session && estado.session.status !== 'ended';
  useEffect(() => {
    if (!temSessao) return undefined;
    let espera: number | undefined;
    const intervalo = window.setInterval(() => { void carregar(true); }, CONSULTA_A_CADA_MS);
    const aoVivo = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => { void carregar(true); }, ESPERA_DO_EVENTO_MS);
    };
    window.addEventListener('lmflow:realtime', aoVivo);
    return () => {
      window.clearInterval(intervalo);
      window.clearTimeout(espera);
      window.removeEventListener('lmflow:realtime', aoVivo);
    };
  }, [temSessao, carregar]);

  const comecar = useCallback(async (leadName: string) => {
    try {
      await demoRoomService.start(leadName);
      await carregar(true);
    } catch (e) {
      toast.error(mensagemDe(e, 'Não consegui começar a demonstração.'));
    }
  }, [carregar]);

  const followupAgora = useCallback(async (): Promise<{ ok: boolean; message: string } | undefined> => {
    const id = estado?.session?.id;
    if (!id) return undefined;
    try {
      const r = await demoRoomService.followupNow(id);
      await carregar(true);
      return r;
    } catch (e) {
      return { ok: false, message: mensagemDe(e, 'Não consegui disparar o follow-up agora.') };
    }
  }, [estado?.session?.id, carregar]);

  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const sessaoId = estado?.session?.id;
  const recomecar = useCallback(async () => {
    if (!sessaoId) return;
    const sim = await confirmar({
      titulo: 'Recomeçar a demonstração?',
      descricao: 'Recomeçar apaga esta conversa.',
      rotuloDaAcao: 'Recomeçar',
      destrutivo: true,
    });
    if (!sim) return;
    try {
      await demoRoomService.reset(sessaoId);
      await carregar(true);
    } catch (e) {
      toast.error(mensagemDe(e, 'Não consegui recomeçar a demonstração.'));
    }
  }, [sessaoId, confirmar, carregar]);

  // Sessão encerrada vale como sem sessão: a página volta pro Preparar.
  const sessao = estado?.session && estado.session.status !== 'ended' ? estado.session : null;
  const cabecalho = (
    <BaseHeader
      title="Sala de demonstração"
      secondaryActions={sessao ? [{ label: 'Recomeçar', variant: 'outline', onClick: () => { void recomecar(); } }] : []}
    />
  );

  if (carga === 'carregando') {
    return (
      <Pagina cabecalho={cabecalho}>
        <Carregando variante="texto" linhas={4} rotulo="Carregando a Sala..." />
      </Pagina>
    );
  }

  if (carga === 'semAcesso') {
    return (
      <Pagina cabecalho={cabecalho}>
        <NoAccessState />
      </Pagina>
    );
  }

  if (carga === 'foraDaDemo') {
    return (
      <Pagina cabecalho={cabecalho}>
        <EmptyState title="A Sala de demonstração só existe no espaço de demonstração" />
      </Pagina>
    );
  }

  if (carga === 'erro' || !estado) {
    return (
      <Pagina cabecalho={cabecalho}>
        <EmptyState tipo="erro" aoTentarDeNovo={() => { setCarga('carregando'); void carregar(false); }} />
      </Pagina>
    );
  }

  return (
    <Pagina cabecalho={cabecalho}>
      {dialogoDeConfirmacao}
      {!sessao && <Preparar state={estado} onStart={comecar} onSaved={() => carregar(true)} />}
      {sessao?.status === 'waiting' && <QrDaSala session={sessao} waNumber={estado.config.wa_number} />}
      {sessao && sessao.status !== 'waiting' && (
        // Lado a lado na tela grande (a da call); empilhado na tela pequena.
        <div data-testid="sala-ao-vivo" className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <ConversaAoVivo conversationId={sessao.conversation_id} refreshKey={leitura} />
          </div>
          <div className="min-w-0 space-y-6">
            <Bastidores behind={estado.behind} />
            <FollowupDaSala steps={estado.followup} onAgora={followupAgora} agentId={estado.config.agent_id} />
          </div>
        </div>
      )}
    </Pagina>
  );
}
