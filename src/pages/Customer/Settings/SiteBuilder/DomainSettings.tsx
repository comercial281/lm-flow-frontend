import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Input, Badge, Label as UILabel } from '@evoapi/design-system';
import { Button } from '@/components/ui/ds';
import {
  Globe, Copy, Check, RefreshCw, Trash2, AlertTriangle,
  Loader2, ExternalLink, ShieldCheck,
} from 'lucide-react';
import {
  siteBuilderService,
  SiteDomainState,
  SiteDomainStatus,
} from '@/services/siteBuilder/siteBuilderService';

import { useConfirmacao } from '@/hooks/useConfirmacao';
import Aviso from '@/components/base/Aviso';
import { Card } from '@/components/ui/ds';
const POLL_INTERVAL_MS = 15_000;

const PENDING: SiteDomainStatus[] = ['pending_dns', 'pending_verification'];

const STATUS_BADGE: Record<SiteDomainStatus, string> = {
  disabled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  none: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  not_registered: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  pending_dns: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  pending_verification: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.');
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copiar"
      className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function RecordRow({ label, type, name, value }: { label: string; type: string; name: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Tipo</dt>
        <dd className="font-mono">{type}</dd>
        <dt className="text-muted-foreground">Nome</dt>
        <dd className="flex items-center gap-1">
          <span className="min-w-0 flex-1 truncate font-mono">{name}</span>
          <CopyButton value={name} />
        </dd>
        <dt className="text-muted-foreground">Valor</dt>
        <dd className="flex items-center gap-1">
          <span className="min-w-0 flex-1 truncate font-mono">{value}</span>
          <CopyButton value={value} />
        </dd>
      </dl>
    </div>
  );
}

export default function DomainSettings({ siteId }: { siteId: string }) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [state, setState] = useState<SiteDomainState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  // Guarda o status atual para o polling não precisar recriar o timer a cada render.
  const statusRef = useRef<SiteDomainStatus | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await siteBuilderService.getDomain(siteId);
      setState(data);
      statusRef.current = data.status;
    } catch {
      if (!silent) toast.error('Erro ao carregar o domínio');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  // Enquanto o DNS não propaga, reconsulta sozinho — o cliente vê o verde acender.
  useEffect(() => {
    const timer = setInterval(() => {
      if (statusRef.current && PENDING.includes(statusRef.current)) load(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const run = async (fn: () => Promise<SiteDomainState>, okMessage: string) => {
    setBusy(true);
    try {
      const data = await fn();
      setState(data);
      statusRef.current = data.status;
      toast.success(okMessage);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(message ?? 'Não foi possível concluir a operação');
    } finally {
      setBusy(false);
    }
  };

  const connect = () => {
    const domain = input.trim();
    if (!domain) {
      toast.error('Digite o domínio do cliente');
      return;
    }
    run(() => siteBuilderService.connectDomain(siteId, domain), 'Domínio conectado — agora aponte o DNS');
  };

  const disconnect = async () => {
    if (!(await confirmar({
      titulo: 'Desconectar domínio',
      descricao: <>Desconectar <strong>{state?.domain}</strong>? O portal volta a responder só pelo endereço padrão.</>,
      rotuloDaAcao: 'Desconectar',
      destrutivo: true,
    }))) return;
    run(() => siteBuilderService.disconnectDomain(siteId), 'Domínio desconectado');
    setInput('');
  };

  if (loading) {
    return (
      <Card className="gap-0 p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando domínio...
        </div>
      </Card>
    );
  }

  const status = state?.status ?? 'none';
  const isPending = PENDING.includes(status);

  return (
    <>
    <Card className="gap-0 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Globe className="h-4 w-4" />
          Domínio próprio
        </h2>
        {state && (
          <Badge className={STATUS_BADGE[status]}>
            {status === 'active' && <ShieldCheck className="mr-1 inline h-3 w-3" />}
            {state.status_label}
          </Badge>
        )}
      </div>

      {/* Integração desligada no servidor */}
      {state && !state.configured && (
        <Aviso tom="atencao" titulo="Integração com a Vercel não configurada">
          <p>
            O domínio próprio ainda não pode ser ligado por aqui: falta uma configuração no
            servidor do seu LM Flow. Fale com o suporte.
          </p>
        </Aviso>
      )}

      {/* Nenhum domínio ainda */}
      {state?.configured && status === 'none' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Coloque o site no endereço da imobiliária, por exemplo{' '}
            <span className="font-mono">renatogarcia.com.br</span>. Quando o domínio ficar ativo, ele abre
            só o site (nunca o LM Flow), e o endereço de hoje continua funcionando.
          </p>
          <div>
            <UILabel htmlFor="new-domain">Domínio do cliente</UILabel>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <Input
                id="new-domain"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') connect(); }}
                placeholder="renatogarcia.com.br"
                className="font-mono"
                disabled={busy}
              />
              <Button onClick={connect} disabled={busy} className="shrink-0">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
                Conectar domínio
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Digite sem <span className="font-mono">https://</span> e sem <span className="font-mono">www</span> —
              o www é configurado junto, automaticamente.
            </p>
          </div>
        </div>
      )}

      {/* Domínio conectado */}
      {state?.configured && status !== 'none' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 break-all font-mono text-sm font-medium">{state.domain}</span>
            {status === 'active' && (
              <a
                href={`https://${state.domain}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Abrir <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {status === 'active' && (
            <Aviso tom="sucesso" icone={ShieldCheck}>
              <p className="break-all font-medium">Ativo: o site abre em {state.domain}.</p>
              <p>
                Nesse endereço aparece só o site, com um endereço curto para cada página. O endereço
                de hoje continua funcionando, e os links de
                imóvel que a IA manda passam a usar o domínio. O certificado de segurança é renovado
                sozinho: não é preciso fazer mais nada.
              </p>
            </Aviso>
          )}

          {status === 'not_registered' && (
            <Aviso
              tom="erro"
              titulo="Este domínio não está mais registrado na Vercel"
              acao={
                <Button
                  onClick={() => run(
                    () => siteBuilderService.connectDomain(siteId, state.domain as string),
                    'Domínio registrado novamente',
                  )}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Registrar novamente
                </Button>
              }
            >
              <p>
                Provavelmente foi removido direto no painel da Vercel. O portal não responde por
                ele até ser registrado de novo.
              </p>
            </Aviso>
          )}

          {isPending && (
            <>
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <p className="text-sm font-medium">Falta o cliente apontar o domínio</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Entre onde o domínio foi registrado (Registro.br, GoDaddy, Cloudflare...), abra a
                  área de <strong>DNS</strong> e cadastre os registros abaixo. Depois é só esperar —
                  esta tela confirma sozinha quando propagar.
                </p>
                <p className="mt-2 flex gap-2 text-xs text-orange-700 dark:text-orange-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Se o cliente usa e-mail nesse domínio, <strong>não mexa nos registros MX</strong>.
                    Alterar MX derruba o e-mail dele.
                  </span>
                </p>
              </div>

              {state.dns_records.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {state.dns_records.map(r => (
                    <RecordRow
                      key={`${r.domain}-${r.type}`}
                      label={r.domain}
                      type={r.type}
                      name={r.name}
                      value={r.value}
                    />
                  ))}
                </div>
              )}

              {state.verification.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Este domínio já está cadastrado em outra conta Vercel. Para provar que é seu,
                    adicione também:
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {state.verification.map(v => (
                      <RecordRow
                        key={`${v.name}-${v.value}`}
                        label="Verificação de propriedade"
                        type={v.type}
                        name={v.name}
                        value={v.value}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button
              variant="outline"
              onClick={() => run(() => siteBuilderService.verifyDomain(siteId), 'Verificação atualizada')}
              disabled={busy}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Verificar agora
            </Button>
            <Button variant="outline" onClick={disconnect} disabled={busy}
              className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20">
              <Trash2 className="mr-2 h-4 w-4" />
              Desconectar
            </Button>
            {isPending && (
              <span className="text-xs text-muted-foreground">
                Verificando sozinho a cada 15s — pode deixar esta tela aberta.
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
      {dialogoDeConfirmacao}
    </>
  );
}
