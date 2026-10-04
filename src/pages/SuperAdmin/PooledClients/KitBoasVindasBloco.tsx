import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, Film, Gift, Loader2, Send, X } from 'lucide-react';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { dataHora } from '@/lib/formato';
import {
  welcomeKitService, type KitDelivery, type KitPreview, type KitTenantState,
} from '@/services/superAdmin/welcomeKitService';
import {
  INTERVALO_MS, esperaEstourou, motivo, rotuloDoBotao, textoAndamento, textoUltimoEnvio,
} from '../kitBoasVindasRegras';

/**
 * Clientes → Funções → Kit de boas-vindas: manda no grupo oficial do cliente o
 * kit montado em Plataforma → Kit de boas-vindas.
 *
 * Ao abrir só lê o último envio (barato). O grupo é buscado no clique de
 * *Preparar envio*: buscar é conversar com o WhatsApp operacional — mesma regra
 * do bloco Grupos WhatsApp, logo acima. O envio roda no servidor; a janela
 * acompanha de 3 em 3 s e pode ser fechada sem parar nada.
 */
export default function KitBoasVindasBloco({ tenantId }: { tenantId: string }) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [estado, setEstado] = useState<KitTenantState | null>(null);
  const [erroLeitura, setErroLeitura] = useState<string | null>(null);
  const [prev, setPrev] = useState<KitPreview | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [andamento, setAndamento] = useState<KitDelivery | null>(null);
  const [acompanhando, setAcompanhando] = useState(false);
  const [demorou, setDemorou] = useState(false);

  const ler = useCallback(async () => {
    try {
      const s = await welcomeKitService.tenantState(tenantId);
      setEstado(s);
      setErroLeitura(null);
      if (s.progress?.state === 'running') {
        setAndamento(s.progress);
        setAcompanhando(true);
      }
    } catch (e) {
      setErroLeitura(motivo(e, 'Não consegui ler o último envio do kit.'));
    }
  }, [tenantId]);

  useEffect(() => { void ler(); }, [ler]);

  // Acompanha o envio que roda no servidor. Oscilação de rede no meio não
  // cancela nada: tenta de novo no ciclo seguinte, calado. Teto de 10 min.
  useEffect(() => {
    if (!acompanhando) return undefined;
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout>;
    const inicio = Date.now();
    const ciclo = async () => {
      try {
        const s = await welcomeKitService.tenantState(tenantId);
        if (cancelado) return;
        setEstado(s);
        if (!s.progress || s.progress.state === 'done') {
          setAndamento(null);
          setAcompanhando(false);
          return;
        }
        setAndamento(s.progress);
      } catch {
        // rede oscilou: o próximo ciclo tenta de novo
      }
      if (cancelado) return;
      if (esperaEstourou(inicio, Date.now())) {
        setDemorou(true);
        setAcompanhando(false);
        return;
      }
      timer = setTimeout(ciclo, INTERVALO_MS);
    };
    timer = setTimeout(ciclo, INTERVALO_MS);
    return () => { cancelado = true; clearTimeout(timer); };
  }, [acompanhando, tenantId]);

  const preparar = async () => {
    setPreparando(true);
    setErroAcao(null);
    try {
      setPrev(await welcomeKitService.preview(tenantId));
    } catch (e) {
      setErroAcao(motivo(e, 'Não consegui preparar o envio.'));
    } finally {
      setPreparando(false);
    }
  };

  const enviar = async () => {
    if (!prev?.target) return;
    const ok = await confirmar({
      titulo: 'Mandar o kit no grupo?',
      descricao: <>Vai para <strong>{prev.target.name}</strong>. Não dá para desfazer.</>,
      rotuloDaAcao: 'Enviar',
    });
    if (!ok) return;
    setEnviando(true);
    setErroAcao(null);
    setDemorou(false);
    try {
      setAndamento(await welcomeKitService.deliver(tenantId));
      setPrev(null);
      setAcompanhando(true);
    } catch (e) {
      // 409: já tem um envio rodando para este cliente. Acompanha o que está
      // rodando em vez de mandar de novo.
      const r = (e as { response?: { status?: number; data?: { progress?: KitDelivery } } }).response;
      if (r?.status === 409 && r.data?.progress) {
        setAndamento(r.data.progress);
        setPrev(null);
        setAcompanhando(true);
      } else {
        setErroAcao(motivo(e, 'Não consegui começar o envio.'));
      }
    } finally {
      setEnviando(false);
    }
  };

  const ultimo = estado?.last ?? null;
  const falhas = (ultimo?.items ?? []).filter(i => i.status === 'failed');
  const rodando = andamento?.state === 'running';
  const configurado = estado?.configured ?? false;

  return (
    <div className="px-3 py-2.5 rounded-lg mb-1"
      style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.25)' }}>
      <div className="flex items-center gap-2 text-sm text-white/90"><Gift className="w-3.5 h-3.5" /> Kit de boas-vindas</div>
      <div className="text-xs text-white/40 mb-2 mt-0.5">
        O endereço do CRM, o vídeo de como instalar o aplicativo e as imagens de como conectar o WhatsApp,
        no grupo do cliente, pelo número operacional.
      </div>

      {erroLeitura && (
        <div className="flex items-center gap-2 text-xs text-white/50">
          {erroLeitura}
          <button onClick={() => void ler()} className="underline text-white/70">Tentar de novo</button>
        </div>
      )}

      {estado && !configurado && (
        <div className="text-xs text-amber-300 mb-2">
          O kit ainda não foi montado. Monte em{' '}
          <Link to="/admin/plataforma/kit-boas-vindas" className="underline">Plataforma → Kit de boas-vindas</Link>.
        </div>
      )}

      {estado && !rodando && (
        <div className="text-xs text-white/70">
          {textoUltimoEnvio(ultimo)}
          {ultimo && <span className="text-white/40"> · {ultimo.group.name}</span>}
        </div>
      )}
      {!rodando && falhas.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {falhas.map(f => (
            <li key={f.label} className="text-[11px] text-amber-300/90">{f.label}: {f.detail || 'falhou'}</li>
          ))}
        </ul>
      )}

      {rodando && andamento && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-white/80">
            <Loader2 className="w-3 h-3 animate-spin" /> {textoAndamento(andamento)}
            <span className="text-white/40">· {andamento.group.name}</span>
          </div>
          <ul className="space-y-0.5">
            {andamento.items.map(it => (
              <li key={it.label} className="flex items-center gap-1.5 text-[11px] text-white/60">
                {it.status === 'sent' && <Check className="w-3 h-3 text-emerald-300" />}
                {it.status === 'failed' && <X className="w-3 h-3 text-red-300" />}
                {it.status === 'queued' && <span className="w-3 h-3 inline-block rounded-full border border-white/30" />}
                {it.label}{it.status === 'failed' && it.detail ? `: ${it.detail}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {demorou && (
        <div className="text-xs text-amber-300 mt-1">O envio está demorando. Feche e abra de novo daqui a pouco.</div>
      )}

      {!rodando && !prev && (
        <button onClick={() => void preparar()} disabled={!configurado || preparando}
          className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/90 disabled:opacity-50">
          {preparando ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Preparar envio'}
        </button>
      )}

      {!rodando && prev && (
        <div className="mt-2 space-y-2 rounded-md px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {prev.target ? (
            <div className="text-xs text-white/80">
              Vai para: <span className="text-emerald-300">{prev.target.name}</span>{' '}
              <span className="text-white/40">
                ({prev.target.source === 'cadastro' ? 'Cadastrado na ficha' : 'Reconhecido pelo nome'})
              </span>
              {prev.target.found === false && (
                <div className="text-[11px] text-amber-300/80">Não apareceu na lista do número que envia.</div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-1.5 text-xs text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {prev.reason}
            </div>
          )}

          <div className="space-y-1.5">
            {prev.pieces.map(p => (
              <div key={p.label} className="rounded px-2 py-1.5 text-xs text-white/80" style={{ background: 'rgba(255,255,255,0.05)' }}>
                {p.kind === 'text' && <div className="whitespace-pre-wrap">{p.text}</div>}
                {p.kind === 'video' && <div className="flex items-center gap-1.5"><Film className="w-3.5 h-3.5" /> {p.name}</div>}
                {p.kind === 'image' && (
                  <div className="flex items-center gap-2">
                    <img src={p.url} alt="" className="h-10 w-10 rounded object-cover" />
                    <span>{p.caption || <span className="text-white/40">{p.label}</span>}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {prev.last && (
            <div className="text-[11px] text-amber-300/80">
              Este kit já foi enviado em {dataHora(prev.last.finished_at || prev.last.started_at)}. Enviar de novo manda tudo outra vez.
            </div>
          )}

          <div className="flex items-center gap-2">
            {prev.target && (
              <button onClick={() => void enviar()} disabled={enviando}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white disabled:opacity-50">
                {enviando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                {rotuloDoBotao(prev.pieces.length)}
              </button>
            )}
            <button onClick={() => setPrev(null)} disabled={enviando}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/70 disabled:opacity-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {erroAcao && <div className="text-xs text-amber-300 mt-1">{erroAcao}</div>}
      {dialogoDeConfirmacao}
    </div>
  );
}
