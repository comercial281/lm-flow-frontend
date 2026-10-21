// ── SALA DE DEMONSTRAÇÃO (/sala-demonstracao) ────────────────────────────────
//
// Tela escondida: só aparece no espaço de demonstração e só para administrador.
// Três estados: sem sessão (Preparar), sessão esperando o lead (QR) e sessão no
// ar (conversa + bastidores + follow-up). Enquanto há sessão, relê o estado a
// cada 3 s e também quando chega o evento 'lmflow:realtime' (espera de 500 ms
// para juntar rajadas).
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Pagina, BaseHeader, EmptyState, Carregando } from '@/components/base';
import NoAccessState from '@/components/permissions/NoAccessState';
import { demoRoomService } from '@/services/demoRoom/demoRoomService';
import type { DemoRoomState } from '@/types/demoRoom';
import Preparar from './Preparar';
import QrDaSala from './QrDaSala';
import ConversaAoVivo from './ConversaAoVivo';
import Bastidores from './Bastidores';
import FollowupDaSala from './FollowupDaSala';
import { useEhAdmin } from './useEhAdmin';

const CONSULTA_A_CADA_MS = 3000;
const ESPERA_DO_EVENTO_MS = 500;

type Carga = 'carregando' | 'ok' | 'foraDaDemo' | 'erro';

function status404(e: unknown): boolean {
  return (e as { response?: { status?: number } } | null)?.response?.status === 404;
}

function mensagemDe(e: unknown, padrao: string): string {
  return e instanceof Error && e.message ? e.message : padrao;
}

export default function SalaDemonstracao() {
  const admin = useEhAdmin();
  const [estado, setEstado] = useState<DemoRoomState | null>(null);
  const [carga, setCarga] = useState<Carga>('carregando');
  const vivo = useRef(true);

  const carregar = useCallback(async (silencioso: boolean) => {
    try {
      const novo = await demoRoomService.get();
      if (!vivo.current) return;
      setEstado(novo);
      setCarga('ok');
    } catch (e) {
      if (!vivo.current) return;
      if (status404(e)) { setCarga('foraDaDemo'); return; }
      // Consulta de fundo que falha não derruba a tela: mantém o último estado.
      if (!silencioso) setCarga('erro');
    }
  }, []);

  useEffect(() => {
    vivo.current = true;
    if (admin) void carregar(false);
    return () => { vivo.current = false; };
  }, [admin, carregar]);

  const temSessao = !!estado?.session;
  useEffect(() => {
    if (!admin || !temSessao) return undefined;
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
  }, [admin, temSessao, carregar]);

  const comecar = useCallback(async (leadName: string) => {
    try {
      await demoRoomService.start(leadName);
      await carregar(true);
    } catch (e) {
      toast.error(mensagemDe(e, 'Não consegui começar a demonstração.'));
    }
  }, [carregar]);

  const followupAgora = useCallback(async () => {
    const id = estado?.session?.id;
    if (!id) return;
    try {
      const r = await demoRoomService.followupNow(id);
      if (r.ok) toast.success(r.message); else toast.error(r.message);
      await carregar(true);
    } catch (e) {
      toast.error(mensagemDe(e, 'Não consegui disparar o follow-up agora.'));
    }
  }, [estado?.session?.id, carregar]);

  const cabecalho = <BaseHeader title="Sala de demonstração" />;

  if (!admin) return <NoAccessState />;

  if (carga === 'carregando') {
    return (
      <Pagina cabecalho={cabecalho}>
        <Carregando variante="texto" linhas={4} rotulo="Carregando a Sala..." />
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

  const sessao = estado.session;
  return (
    <Pagina cabecalho={cabecalho}>
      {!sessao && <Preparar state={estado} onStart={comecar} />}
      {sessao?.status === 'waiting' && <QrDaSala session={sessao} />}
      {sessao && sessao.status !== 'waiting' && (
        <div className="space-y-4">
          <ConversaAoVivo conversationId={sessao.conversation_id} />
          <Bastidores behind={estado.behind} />
          <FollowupDaSala steps={estado.followup} onAgora={followupAgora} />
        </div>
      )}
    </Pagina>
  );
}
