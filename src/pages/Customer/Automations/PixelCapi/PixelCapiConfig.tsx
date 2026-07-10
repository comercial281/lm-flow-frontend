import { useEffect, useMemo, useState } from 'react';
import {
  capiConfigService,
  CAPI_EVENT_LABELS,
  CAPI_INTENT_LABELS,
  type CapiConfig,
  type CapiStageRule,
} from '@/services/capi/capiConfigService';

const VALUE_EVENTS = ['Purchase', 'UltraQualificado'];

function emptyRule(): CapiStageRule {
  return { event_name: '', enabled: false, to_client: true, to_lm: true, intent: 'none' };
}

export default function PixelCapiConfig() {
  const [config, setConfig] = useState<CapiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Campos editáveis (separados do config carregado).
  const [isEnabled, setIsEnabled] = useState(false);
  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState(''); // vazio = não altera
  const [contributeToLm, setContributeToLm] = useState(false);
  const [testEventCode, setTestEventCode] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [stageMap, setStageMap] = useState<Record<string, CapiStageRule>>({});

  useEffect(() => {
    let alive = true;
    capiConfigService
      .get()
      .then((c) => {
        if (!alive) return;
        setConfig(c);
        setIsEnabled(c.is_enabled);
        setPixelId(c.pixel_id ?? '');
        setContributeToLm(c.contribute_to_lm);
        setTestEventCode(c.test_event_code ?? '');
        setCurrency(c.default_currency || 'BRL');
        setStageMap(c.stage_map || {});
      })
      .catch(() => alive && setError('Não foi possível carregar a configuração.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const eventOptions = useMemo(() => config?.known_events ?? [], [config]);
  const intentOptions = useMemo(() => config?.intents ?? ['lookalike', 'exclusion', 'none'], [config]);

  function rule(stageId: string): CapiStageRule {
    return stageMap[stageId] ?? emptyRule();
  }

  function patchRule(stageId: string, patch: Partial<CapiStageRule>) {
    setStageMap((prev) => {
      const current = prev[stageId] ?? emptyRule();
      return { ...prev, [stageId]: { ...current, ...patch } };
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      // Só manda estágios que têm evento escolhido (mapa enxuto).
      const cleanMap: Record<string, CapiStageRule> = {};
      Object.entries(stageMap).forEach(([id, r]) => {
        if (r.event_name) cleanMap[id] = r;
      });
      const updated = await capiConfigService.update({
        is_enabled: isEnabled,
        pixel_id: pixelId.trim() || null,
        ...(accessToken.trim() ? { access_token: accessToken.trim() } : {}),
        contribute_to_lm: contributeToLm,
        test_event_code: testEventCode.trim() || null,
        default_currency: currency,
        stage_map: cleanMap,
      });
      setConfig(updated);
      setStageMap(updated.stage_map || {});
      setAccessToken('');
      setSaved(true);
    } catch {
      setError('Erro ao salvar. Confira os dados e tente de novo.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  const inputCls =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40';
  const labelCls = 'text-sm font-medium text-foreground';

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-8">
      <header>
        <h1 className="text-lg font-semibold text-foreground">Pixel / Conversões (CAPI)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte o pixel deste cliente e escolha qual coluna do CRM dispara qual evento para o Meta.
          Cada evento alimenta o pixel do cliente e, opcionalmente, o acervo geral da Leal Mídia.
        </p>
      </header>

      {/* Pixel do cliente */}
      <section className="space-y-4 rounded-lg border border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Pixel do cliente</h2>
            <p className="text-xs text-muted-foreground">O ativo dele — conta de anúncio do próprio cliente.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
            Ativo
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className={labelCls}>Pixel ID</label>
            <input className={inputCls} value={pixelId} onChange={(e) => setPixelId(e.target.value)} placeholder="Ex: 1543903880225628" />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Token CAPI</label>
            <input
              className={inputCls}
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={config?.access_token_set ? '•••••• (configurado — deixe vazio p/ manter)' : 'Cole o token da Conversions API'}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Moeda padrão</label>
            <input className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="BRL" />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Código de teste (opcional)</label>
            <input className={inputCls} value={testEventCode} onChange={(e) => setTestEventCode(e.target.value)} placeholder="TEST12345 (Events Manager)" />
          </div>
        </div>
      </section>

      {/* Acervo geral Leal Mídia */}
      <section className="space-y-2 rounded-lg border border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Acervo geral Leal Mídia</h2>
            <p className="text-xs text-muted-foreground">
              Também enviar as conversões deste cliente para o dataset central da Leal Mídia
              (inteligência e públicos semelhantes).
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={contributeToLm} onChange={(e) => setContributeToLm(e.target.checked)} />
            Contribuir
          </label>
        </div>
        {!config?.lm_pixel_configured && (
          <p className="text-xs text-amber-600">
            O pixel do acervo geral ainda não está configurado no sistema (LM_CAPI_PIXEL_ID / LM_CAPI_TOKEN).
          </p>
        )}
      </section>

      {/* Mapa coluna -> evento */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Colunas do CRM → eventos</h2>
          <p className="text-xs text-muted-foreground">
            Para cada coluna, escolha o evento que dispara quando o card entra nela.
          </p>
        </div>

        {(config?.pipelines ?? []).map((pipeline) => (
          <div key={pipeline.id} className="rounded-lg border border-border">
            <div className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">
              {pipeline.name || 'Pipeline'}
            </div>
            <div className="divide-y divide-border">
              {pipeline.stages.map((stage) => {
                const r = rule(stage.id);
                const showValue = VALUE_EVENTS.includes(r.event_name);
                return (
                  <div key={stage.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="w-40 shrink-0 truncate text-sm text-foreground">{stage.name || '—'}</span>

                    <select
                      className={`${inputCls} w-44`}
                      value={r.event_name}
                      onChange={(e) => patchRule(stage.id, { event_name: e.target.value, enabled: !!e.target.value })}
                    >
                      <option value="">Não disparar</option>
                      {eventOptions.map((ev) => (
                        <option key={ev} value={ev}>
                          {CAPI_EVENT_LABELS[ev] ?? ev}
                        </option>
                      ))}
                    </select>

                    {r.event_name && (
                      <>
                        <label className="flex items-center gap-1 text-xs text-muted-foreground">
                          <input type="checkbox" checked={r.to_client} onChange={(e) => patchRule(stage.id, { to_client: e.target.checked })} />
                          Cliente
                        </label>
                        <label className="flex items-center gap-1 text-xs text-muted-foreground">
                          <input type="checkbox" checked={r.to_lm} onChange={(e) => patchRule(stage.id, { to_lm: e.target.checked })} />
                          Acervo LM
                        </label>

                        <select
                          className={`${inputCls} w-52`}
                          value={r.intent ?? 'none'}
                          onChange={(e) => patchRule(stage.id, { intent: e.target.value as CapiStageRule['intent'] })}
                        >
                          {intentOptions.map((it) => (
                            <option key={it} value={it}>
                              {CAPI_INTENT_LABELS[it] ?? it}
                            </option>
                          ))}
                        </select>

                        {showValue && (
                          <input
                            className={`${inputCls} w-40`}
                            value={r.value_field ?? ''}
                            onChange={(e) => patchRule(stage.id, { value_field: e.target.value || null })}
                            placeholder="Valor: card_value"
                          />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              {pipeline.stages.length === 0 && (
                <div className="px-4 py-3 text-xs text-muted-foreground">Sem colunas neste pipeline.</div>
              )}
            </div>
          </div>
        ))}

        {(config?.pipelines ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum pipeline encontrado para este cliente.</p>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        {saved && <span className="text-sm text-green-600">Salvo.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
