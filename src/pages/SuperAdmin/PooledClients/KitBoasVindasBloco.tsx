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
        if (!s.progress || s.progress.state !== 'running') {
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
      setAndamento(await welcomeKitService.deliver(tenantId, prev.target.jid));
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
        // Recusado (grupo mudou desde a prévia, sem destino): a prévia que estava
        // na tela não vale mais, então volta para *Preparar envio*.
        setErroAcao(motivo(e, 'Não consegui começar o envio.'));
        setPrev(null);
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
    <section aria-label="Kit de boas-vindas" className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-foreground"><Gift className="w-3.5 h-3.5" /> Kit de boas-vindas</div>
      <div className="text-xs text-muted-foreground mb-2 mt-0.5">
        O endereço do CRM, o vídeo de como instalar o aplicativo e as imagens de como conectar o WhatsApp,
        no grupo do cliente, pelo número operacional.
      </div>

      {erroLeitura && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {erroLeitura}
          <button onClick={() => void ler()} className="underline text-foreground">Tentar de novo</button>
        </div>
      )}

      {estado && !configurado && (
        <div className="text-xs text-amber-600 dark:text-amber-400 mb-2">
          O kit ainda não foi montado. Monte em{' '}
          <Link to="/admin/plataforma/kit-boas-vindas" className="underline">Plataforma → Kit de boas-vindas</Link>.
        </div>
      )}

      {estado && !rodando && (
        <div className="text-xs text-muted-foreground">
          {textoUltimoEnvio(ultimo)}
          {ultimo && <span className="text-muted-foreground"> · {ultimo.group.name}</span>}
        </div>
      )}
      {!rodando && falhas.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {falhas.map(f => (
            <li key={f.label} className="text-[11px] text-amber-600 dark:text-amber-400">{f.label}: {f.detail || 'falhou'}</li>
          ))}
        </ul>
      )}

      {rodando && andamento && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> {textoAndamento(andamento)}
            <span className="text-muted-foreground">· {andamento.group.name}</span>
          </div>
          <ul className="space-y-0.5">
            {andamento.items.map(it => (
              <li key={it.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {it.status === 'sent' && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                {it.status === 'failed' && <X className="w-3 h-3 text-destructive" />}
                {it.status === 'queued' && <span className="w-3 h-3 inline-block rounded-full border border-muted-foreground/50" />}
                {it.label}{it.status === 'failed' && it.detail ? `: ${it.detail}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {demorou && (
        <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">O envio está demorando. Feche e abra de novo daqui a pouco.</div>
      )}

      {!rodando && !prev && (
        <button onClick={() => void preparar()} disabled={!configurado || preparando}
          className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground disabled:opacity-50">
          {preparando ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Preparar envio'}
        </button>
      )}

      {!rodando && prev && (
        <div className="mt-2 space-y-2 rounded-md bg-muted/50 px-2.5 py-2">
          {prev.target ? (
            <div className="text-xs text-foreground">
              Vai para: <span className="text-emerald-600 dark:text-emerald-400">{prev.target.name}</span>{' '}
              <span className="text-muted-foreground">
                ({prev.target.source === 'cadastro' ? 'Cadastrado na ficha' : 'Reconhecido pelo nome'})
              </span>
              {prev.target.found === false && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400">Não apareceu na lista do número que envia.</div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {prev.reason}
            </div>
          )}

          <div className="space-y-1.5">
            {prev.pieces.map(p => (
              <div key={p.label} className="rounded bg-muted px-2 py-1.5 text-xs text-foreground">
                {p.kind === 'text' && <div className="whitespace-pre-wrap">{p.text}</div>}
                {p.kind === 'video' && <div className="flex items-center gap-1.5"><Film className="w-3.5 h-3.5" /> {p.name}</div>}
                {p.kind === 'image' && (
                  <div className="flex items-center gap-2">
                    <img src={p.url} alt="" className="h-10 w-10 rounded object-cover" />
                    <span>{p.caption || <span className="text-muted-foreground">{p.label}</span>}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {prev.last && (
            <div className="text-[11px] text-amber-600 dark:text-amber-400">
              Este kit já foi enviado em {dataHora(prev.last.finished_at || prev.last.started_at)}. Enviar de novo manda tudo outra vez.
            </div>
          )}

          <div className="flex items-center gap-2">
            {prev.target && (
              <button onClick={() => void enviar()} disabled={enviando}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground disabled:opacity-50">
                {enviando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                {rotuloDoBotao(prev.pieces.length)}
              </button>
            )}
            <button onClick={() => setPrev(null)} disabled={enviando}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground disabled:opacity-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {erroAcao && <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">{erroAcao}</div>}
      {dialogoDeConfirmacao}
    </section>
  );
}
