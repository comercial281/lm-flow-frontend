import { useEffect, useState, useCallback } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { Button } from '@/components/ui/ds';
import { Loader2, Repeat, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  followupEnrollmentService,
  type FollowupEnrollmentConfig,
  type FollowupAudience,
} from '@/services/followupEnrollment/followupEnrollmentService';

interface FollowupEnrollmentProps {
  /** Renderiza sem o cabeçalho e o padding de página, pra encaixar dentro da
   *  tela de Follow-up (as duas telas viraram uma só). */
  embedded?: boolean;
}

export function FollowupEnrollment({ embedded = false }: FollowupEnrollmentProps = {}) {
  const [config, setConfig] = useState<FollowupEnrollmentConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [audience, setAudience] = useState<FollowupAudience>('paid');
  const [sequenceSlug, setSequenceSlug] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await followupEnrollmentService.get();
      setConfig(c);
      setEnabled(c.enabled);
      setAudience(c.audience);
      setSequenceSlug(c.sequence_slug ?? c.sequences[0]?.slug ?? '');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao carregar a configuração'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = useCallback(async () => {
    if (!sequenceSlug) { toast.error('Escolha um funil de follow-up'); return; }
    setSaving(true);
    try {
      const c = await followupEnrollmentService.update({ enabled, audience, sequence_slug: sequenceSlug });
      setConfig(c);
      setEnabled(c.enabled);
      setAudience(c.audience);
      setSequenceSlug(c.sequence_slug ?? '');
      if (enabled) {
        toast.success('Follow-up automático ligado');
      } else {
        // Avisa quantos disparos ja agendados foram cortados — o usuario precisa saber
        // que o desligamento pegou a fila, nao so os leads novos.
        const cut = c.cancelled_jobs ?? 0;
        toast.success(
          cut > 0
            ? `Follow-up automático desligado. ${cut} disparo(s) agendado(s) cancelado(s).`
            : 'Follow-up automático desligado',
        );
      }
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  }, [enabled, audience, sequenceSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const noSequences = !config || config.sequences.length === 0;
  const externalRules = config?.external_active_rules ?? [];

  return (
    <div className={embedded ? 'space-y-6' : 'max-w-2xl p-6 space-y-6'}>
      {!embedded && (
        <div className="flex items-center gap-2">
          <Repeat className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Follow-up automático</h2>
            <p className="text-sm text-muted-foreground">
              Coloca o lead no funil de follow-up sozinho. Se o lead responder, o sistema para a sequência automaticamente.
            </p>
          </div>
        </div>
      )}

      {externalRules.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">
              Existe outro follow-up ligado fora deste painel.
            </p>
            <p className="text-muted-foreground">
              {externalRules.length === 1 ? 'A regra abaixo coloca' : 'As regras abaixo colocam'} lead
              em funil de follow-up mesmo com o botão daqui desligado. Desligar aqui desliga
              {externalRules.length === 1 ? '' : 'm'} {externalRules.length === 1 ? 'ela' : 'elas'} também.
            </p>
            <ul className="list-disc pl-4 text-muted-foreground">
              {externalRules.map(r => (
                <li key={r.id}>{r.name}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {noSequences ? (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <Info className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          <span>Nenhum funil de follow-up ativo. Ative um funil na lista abaixo antes de configurar aqui.</span>
        </div>
      ) : (
        <>
          {/* Ligar/desligar */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium">Ativar follow-up automático</h3>
                <p className="text-xs text-muted-foreground">
                  Ligado: novos leads entram no funil sozinhos.<br />
                  Desligado: o funil continua funcionando, mas só quando você mandar — pela tag{' '}
                  <strong>follow-up</strong> ou pelo botão <strong>Ativar follow-up</strong> dentro do card do lead.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => setEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          {/* Audiência */}
          <div className={`rounded-lg border border-border p-4 space-y-3 ${enabled ? '' : 'opacity-50 pointer-events-none'}`}>
            <h3 className="text-sm font-medium">Quais leads entram</h3>
            <div className="space-y-2">
              {config!.audiences.map(opt => (
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
              {audience === 'paid'
                ? 'Só leads marcados como tráfego pago (vindos de anúncio) entram no funil.'
                : 'Todo lead que iniciar conversa entra no funil.'}
            </p>
          </div>

          {/* Funil */}
          <div className={`rounded-lg border border-border p-4 space-y-3 ${enabled ? '' : 'opacity-50 pointer-events-none'}`}>
            <h3 className="text-sm font-medium">Funil de follow-up</h3>
            <select
              value={sequenceSlug}
              onChange={e => setSequenceSlug(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {config!.sequences.map(s => (
                <option key={s.slug} value={s.slug}>
                  {s.name} ({s.steps_count} {s.steps_count === 1 ? 'passo' : 'passos'})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Edite as mensagens e os tempos em <strong>Automações → Follow-ups</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Salvar
            </Button>
            {config?.managed_rule_id && (
              <span className="text-xs text-muted-foreground">
                {config.enabled ? 'Ativo agora.' : 'Desligado.'}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default FollowupEnrollment;
