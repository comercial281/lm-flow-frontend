import { useEffect, useState, useCallback } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { Button } from '@/components/ui/ds';
import { Loader2, Repeat, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  followupEnrollmentService,
  type FollowupEnrollmentConfig,
} from '@/services/followupEnrollment/followupEnrollmentService';

/**
 * Destino do follow-up por ORIGEM do lead.
 *
 * Esta tela já foi o painel global de disparo — uma chave, uma coluna, um funil,
 * pra conta inteira. Esse painel saiu: o disparo automático passou a ser do FUNIL,
 * em "Quando este funil começa", onde cada funil tem as portas de entrada dele.
 *
 * O que sobrou aqui é o único pedaço que NÃO é por funil: quando o lead entra no
 * follow-up pela mão do corretor (botão dentro do card ou etiqueta `follow-up`),
 * não há gatilho pra dizer qual funil usar — quem decide é a origem do lead.
 */

interface FollowupEnrollmentProps {
  /** Renderiza sem o cabeçalho e o padding de página, pra encaixar dentro da
   *  tela de Follow-up (as duas telas viraram uma só). */
  embedded?: boolean;
}

export function FollowupEnrollment({ embedded = false }: FollowupEnrollmentProps = {}) {
  const [config, setConfig] = useState<FollowupEnrollmentConfig | null>(null);
  // Funil de destino por origem do lead. Chave -> slug escolhido na tela.
  const [routing, setRouting] = useState<Record<string, string>>({});
  const [savingRouting, setSavingRouting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await followupEnrollmentService.get();
      setConfig(c);
      setRouting(Object.fromEntries((c.routing ?? []).map(r => [r.key, r.sequence_slug ?? ''])));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao carregar a configuração'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveRouting = useCallback(async () => {
    setSavingRouting(true);
    try {
      const payload: { paid?: string; organic?: string } = {};
      if (routing.paid) payload.paid = routing.paid;
      if (routing.organic) payload.organic = routing.organic;

      const { config: c, missingRules } = await followupEnrollmentService.updateRouting(payload);
      setConfig(c);
      setRouting(Object.fromEntries((c.routing ?? []).map(r => [r.key, r.sequence_slug ?? ''])));

      if (missingRules.length > 0) {
        // Sem a regra, a escolha não tem onde ser gravada. Dizer isso é melhor do que
        // um "salvo" que não muda nada.
        toast.warning(`Salvo, mas este CRM não tem a regra de origem para: ${missingRules.join(', ')}.`);
      } else {
        toast.success('Destino por origem salvo');
      }
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao salvar o destino por origem'));
    } finally {
      setSavingRouting(false);
    }
  }, [routing]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const noSequences = !config || config.sequences.length === 0;
  const externalRules = config?.external_active_rules ?? [];
  const routes = config?.routing ?? [];

  return (
    <div className={embedded ? 'space-y-6' : 'max-w-2xl p-6 space-y-6'}>
      {!embedded && (
        <div className="flex items-center gap-2">
          <Repeat className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Destino do follow-up por origem</h2>
            <p className="text-sm text-muted-foreground">
              Quando o corretor inicia o follow-up pelo card, a origem do lead decide qual
              funil ele recebe.
            </p>
          </div>
        </div>
      )}

      {externalRules.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">
              Existe follow-up sendo iniciado por regra criada à mão.
            </p>
            <p className="text-muted-foreground">
              {externalRules.length === 1 ? 'A regra abaixo coloca' : 'As regras abaixo colocam'} lead
              em funil de follow-up por fora das entradas configuradas nos funis. Se não for
              proposital, desative {externalRules.length === 1 ? 'ela' : 'elas'} em Automações de Lead.
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
      ) : routes.length === 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Este CRM não separa o follow-up por origem do lead — não há o que configurar aqui.</span>
        </div>
      ) : (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div>
            <h3 className="text-sm font-medium">Pra qual funil cada um vai</h3>
            <p className="text-xs text-muted-foreground">
              Vale só pro follow-up que o corretor inicia à mão, pelo botão dentro do card.
              O disparo automático agora é de cada funil, em <strong>Quando este funil começa</strong>,
              dentro do próprio funil.
            </p>
          </div>

          {routes.map(r => (
            <div key={r.key} className="space-y-1">
              <label htmlFor={`routing-${r.key}`} className="text-sm">{r.label}</label>
              <select
                id={`routing-${r.key}`}
                value={routing[r.key] ?? ''}
                disabled={!r.exists}
                onChange={e => setRouting(prev => ({ ...prev, [r.key]: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">Escolha um funil...</option>
                {config!.sequences.map(s => (
                  <option key={s.slug} value={s.slug}>
                    {s.name} ({s.steps_count} {s.steps_count === 1 ? 'passo' : 'passos'})
                  </option>
                ))}
              </select>
              {!r.exists && (
                <p className="text-xs text-amber-500">
                  Este CRM não tem a regra de origem para este caso — não há o que configurar aqui.
                </p>
              )}
              {r.exists && !r.enabled && (
                <p className="text-xs text-amber-500">
                  A regra desta origem está desativada: a escolha fica gravada, mas não vale até
                  alguém reativá-la em Automações de Lead.
                </p>
              )}
            </div>
          ))}

          <Button variant="outline" onClick={handleSaveRouting} disabled={savingRouting} className="gap-2">
            {savingRouting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Salvar destino por origem
          </Button>
        </div>
      )}
    </div>
  );
}

export default FollowupEnrollment;
