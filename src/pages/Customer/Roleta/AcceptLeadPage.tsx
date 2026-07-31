import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, X, Clock, User, Phone, Loader2 } from 'lucide-react';
import { brokerAssignmentsService, BrokerAssignmentDetail } from '@/services/roletaConfig/brokerAssignmentsService';

function fmtMMSS(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function AcceptLeadPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<BrokerAssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<null | 'accept' | 'refuse'>(null);
  const [error, setError] = useState<string | null>(null);
  const [secsLeft, setSecsLeft] = useState<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiredRef = useRef(false);

  const load = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    try {
      const d = await brokerAssignmentsService.get(assignmentId);
      setData(d);
      setSecsLeft(Math.max(0, Math.floor((new Date(d.deadline).getTime() - Date.now()) / 1000)));
    } catch {
      setError('Não foi possível carregar este lead.');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => { load(); }, [load]);

  // Timer regressivo (só enquanto pendente).
  useEffect(() => {
    if (!data || data.status !== 'pending') return;
    tickRef.current = setInterval(() => setSecsLeft(s => Math.max(0, s - 1)), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [data]);

  // Prazo zerado: relê o estado real UMA vez. O contador é local — compara o
  // relógio do aparelho com o deadline do servidor —, então zerar aqui não quer
  // dizer que o backend já passou o lead adiante. Quem decide é ele; sem esta
  // releitura os botões seguiam clicáveis contra um prazo vencido. O ref evita o
  // laço: se o backend ainda devolver `pending`, o efeito re-dispararia sozinho.
  useEffect(() => {
    if (secsLeft > 0 || !data || data.status !== 'pending' || expiredRef.current) return;
    expiredRef.current = true;
    load();
  }, [secsLeft, data, load]);

  const goToConversation = useCallback((d: BrokerAssignmentDetail) => {
    const cid = d.conversation_display_id ?? d.conversation_id;
    if (cid) navigate(`/conversations/${cid}`);
    else navigate('/conversations');
  }, [navigate]);

  async function onAccept() {
    if (!assignmentId) return;
    setActing('accept');
    try {
      const d = await brokerAssignmentsService.accept(assignmentId);
      toast.success('Lead aceito! Abrindo a conversa...');
      goToConversation(d);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Não foi possível aceitar.';
      toast.error(msg);
      setActing(null);
      load();
    }
  }

  async function onRefuse() {
    if (!assignmentId) return;
    setActing('refuse');
    try {
      await brokerAssignmentsService.refuse(assignmentId);
      toast.info('Lead recusado. Passamos para o próximo corretor.');
      setData(d => d ? { ...d, status: 'passed' } : d);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Não foi possível recusar.';
      toast.error(msg);
    } finally {
      setActing(null);
    }
  }

  const expired = secsLeft <= 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F0520] p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2a1a45] bg-[#1A0A2E] p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🔔</span>
          <h1 className="text-lg font-semibold text-white">Novo lead na sua fila</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-white/70">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <p className="py-8 text-center text-red-300">{error}</p>
        ) : !data ? (
          <p className="py-8 text-center text-white/70">Lead não encontrado.</p>
        ) : data.status !== 'pending' ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-white/90">
              {data.status === 'accepted'  ? 'Este lead já foi aceito.' :
               data.status === 'passed'    ? 'Este lead já passou para outro corretor.' :
               // Sem este caso o corretor via "o prazo expirou" — mentira: o prazo
               // parou porque a gestão atribuiu o lead a outra pessoa.
               data.status === 'cancelled' ? 'Este lead foi atribuído a outro corretor pela gestão.' :
               'O prazo deste lead expirou.'}
            </p>
            {data.status === 'accepted' && (
              <button onClick={() => goToConversation(data)} className="text-[#9333EA] hover:underline">
                Abrir a conversa
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Timer */}
            <div className={`mb-5 rounded-xl border p-4 text-center ${expired ? 'border-red-500/40 bg-red-500/10' : 'border-[#7C3AED]/40 bg-[#7C3AED]/10'}`}>
              <div className="flex items-center justify-center gap-2 text-white/70 text-xs mb-1">
                <Clock className="h-4 w-4" /> {expired ? 'Prazo esgotado' : 'Aceite em até'}
              </div>
              <div className={`text-4xl font-bold tabular-nums ${expired ? 'text-red-300' : 'text-white'}`}>
                {fmtMMSS(secsLeft)}
              </div>
              <div className="text-white/50 text-xs mt-1">Se não aceitar, o lead passa para o próximo.</div>
            </div>

            {/* Dados do lead */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2 text-white">
                <User className="h-4 w-4 text-[#9333EA]" /> <span className="font-medium">{data.lead_name}</span>
              </div>
              {data.lead_phone && (
                <div className="flex items-center gap-2 text-white/80">
                  <Phone className="h-4 w-4 text-[#9333EA]" /> {data.lead_phone}
                </div>
              )}
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <Clock className="h-4 w-4" /> Chegou em {new Date(data.assigned_at).toLocaleString('pt-BR')}
              </div>
            </div>

            {/* Botões */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onRefuse}
                disabled={!!acting}
                className="flex items-center justify-center gap-2 rounded-xl border border-red-500/50 bg-red-500/10 py-3 font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
              >
                {acting === 'refuse' ? <Loader2 className="h-5 w-5 animate-spin" /> : <X className="h-5 w-5" />} Recusar
              </button>
              <button
                onClick={onAccept}
                disabled={!!acting}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {acting === 'accept' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Aceitar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
