import { useEffect, useState, useCallback } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { Button } from '@/components/ui/ds';
import { Loader2, Bot, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  noReplyRobotService,
  type NoReplyRobotConfig,
  type NoReplyAudience,
} from '@/services/noReplyRobot/noReplyRobotService';

/**
 * Robô "Sem resposta → follow-up": o que roda sozinho e joga quem não respondeu dentro
 * da régua. Antes não tinha tela nenhuma e não filtrava lead — pegava até conversa
 * pessoal do corretor. Aqui fica tudo dele: liga/desliga e todos os critérios.
 */
export function NoReplyRobot() {
  const [config, setConfig] = useState<NoReplyRobotConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [minutes, setMinutes] = useState(30);
  const [scanWindow, setScanWindow] = useState(6);
  const [audience, setAudience] = useState<NoReplyAudience>('pipeline');
  const [skipUnnamed, setSkipUnnamed] = useState(true);
  const [sequenceSlug, setSequenceSlug] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const apply = useCallback((c: NoReplyRobotConfig) => {
    setConfig(c);
    setEnabled(c.enabled);
    setMinutes(c.minutes);
    setScanWindow(c.scan_window_hours);
    setAudience(c.audience);
    setSkipUnnamed(c.skip_unnamed);
    setSequenceSlug(c.sequence_slug ?? c.sequences[0]?.slug ?? '');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      apply(await noReplyRobotService.get());
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao carregar a configuração do robô'));
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => { load(); }, [load]);

  const handleSave = useCallback(async () => {
    if (enabled && !sequenceSlug) {
      toast.error('Escolha o funil de follow-up antes de ligar o robô');
      return;
    }
    setSaving(true);
    try {
      const c = await noReplyRobotService.update({
        enabled,
        minutes,
        scan_window_hours: scanWindow,
        audience,
        skip_unnamed: skipUnnamed,
        sequence_slug: sequenceSlug || null,
      });
      apply(c);
      toast.success(c.enabled ? 'Robô ligado' : 'Robô desligado — nada dispara sozinho');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  }, [enabled, minutes, scanWindow, audience, skipUnnamed, sequenceSlug, apply]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const noSequences = !config || config.sequences.length === 0;
  const disabledCls = enabled ? '' : 'opacity-50 pointer-events-none';

  return (
    <div className="max-w-2xl p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Robô Sem Resposta</h2>
          <p className="text-sm text-muted-foreground">
            Coloca no follow-up quem recebeu mensagem e não respondeu. Com ele desligado, o
            follow-up só entra na mão: pela tag ou pelo botão "Ativar follow-up" no card.
          </p>
        </div>
      </div>

      {/* Estado atual — verdade do banco, não do formulário */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
        <span>
          Status agora:{' '}
          <strong className={config?.enabled ? 'text-emerald-500' : 'text-muted-foreground'}>
            {config?.enabled ? 'ligado' : 'desligado'}
          </strong>
        </span>
        <span className="text-muted-foreground">Na fila: <strong>{config?.pending_jobs ?? 0}</strong></span>
        <span className="text-muted-foreground">Enviadas 24h: <strong>{config?.sent_24h ?? 0}</strong></span>
      </div>

      {config && config.legacy_active_rules.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          <span>
            Existe regra antiga ativa fora desta tela ({config.legacy_active_rules.map(r => r.name).join(', ')}).
            Ela dispara sem os filtros daqui. Salvar nesta tela desliga essa regra.
          </span>
        </div>
      )}

      {noSequences && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <Info className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          <span>Nenhum funil de follow-up ativo. Crie um em <strong>Automações → Follow-ups</strong> antes de ligar o robô.</span>
        </div>
      )}

      {/* Liga/desliga */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium">Ativar o robô</h3>
            <p className="text-xs text-muted-foreground">Desligado, nenhum follow-up entra sozinho.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Ativar o robô"
            onClick={() => setEnabled(v => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Quem entra */}
      <div className={`rounded-lg border border-border p-4 space-y-3 ${disabledCls}`}>
        <h3 className="text-sm font-medium">Quem o robô pode pegar</h3>
        <div className="space-y-2">
          {(config?.audiences ?? []).map(opt => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="audience"
                value={opt.value}
                checked={audience === opt.value}
                onChange={() => setAudience(opt.value)}
                className="accent-[var(--primary)]"
              />
              {opt.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {audience === 'all'
            ? 'Atenção: pega qualquer conversa sem resposta, inclusive contato que não é lead.'
            : audience === 'paid'
              ? 'Só quem está marcado como tráfego pago (veio de anúncio).'
              : 'Só quem tem card no funil do CRM. É o mais seguro.'}
        </p>

        <label className="flex items-center gap-2 cursor-pointer text-sm pt-2 border-t border-border">
          <input
            type="checkbox"
            checked={skipUnnamed}
            onChange={e => setSkipUnnamed(e.target.checked)}
            className="accent-[var(--primary)]"
          />
          Ignorar contato sem nome salvo
        </label>
        <p className="text-xs text-muted-foreground">
          Sem nome, a mensagem sai como "Olá 5516999999999@s.whatsapp.net".
        </p>
      </div>

      {/* Tempos */}
      <div className={`rounded-lg border border-border p-4 space-y-4 ${disabledCls}`}>
        <h3 className="text-sm font-medium">Tempos</h3>
        <div className="space-y-1">
          <label htmlFor="nrr-minutes" className="text-sm">Esperar sem resposta (minutos)</label>
          <input
            id="nrr-minutes"
            type="number"
            min={5}
            max={10080}
            value={minutes}
            onChange={e => setMinutes(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">Tempo desde o início da conversa até entrar no follow-up.</p>
        </div>
        <div className="space-y-1">
          <label htmlFor="nrr-window" className="text-sm">Olhar conversas das últimas (horas)</label>
          <input
            id="nrr-window"
            type="number"
            min={1}
            max={72}
            value={scanWindow}
            onChange={e => setScanWindow(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">Conversa mais velha que isso o robô nem olha — evita pegar base antiga.</p>
        </div>
      </div>

      {/* Funil */}
      <div className={`rounded-lg border border-border p-4 space-y-3 ${disabledCls}`}>
        <h3 className="text-sm font-medium">Funil de follow-up</h3>
        <select
          value={sequenceSlug}
          onChange={e => setSequenceSlug(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          aria-label="Funil de follow-up"
        >
          {(config?.sequences ?? []).map(s => (
            <option key={s.slug} value={s.slug}>
              {s.name} ({s.steps_count} {s.steps_count === 1 ? 'passo' : 'passos'})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Edite as mensagens e os tempos de cada passo em <strong>Automações → Follow-ups</strong>.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}

export default NoReplyRobot;
