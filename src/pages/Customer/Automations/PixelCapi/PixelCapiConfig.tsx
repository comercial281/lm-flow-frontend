import { useEffect, useMemo, useState } from 'react';
import {
  capiConfigService,
  CAPI_EVENT_LABELS,
  CAPI_INTENT_LABELS,
  type CapiConfig,
  type CapiConnectionTest,
  type CapiStageRule,
  type CapiStatusKey,
} from '@/services/capi/capiConfigService';
import { Seletor } from '@/components/base/Seletor';

const VALUE_EVENTS = ['Purchase', 'UltraQualificado'];

function emptyRule(): CapiStageRule {
  return { event_name: '', enabled: false, to_client: true, intent: 'none' };
}

// Situação do card: os dois momentos que avisam a Meta (spec do funil §3.4).
const SITUACOES: { chave: CapiStatusKey; rotulo: string; dica: string }[] = [
  { chave: 'won', rotulo: 'Ao marcar Ganho', dica: 'A Compra leva o preço estimado do card (Sobre o negócio).' },
  {
    chave: 'lost',
    rotulo: 'Ao marcar Perdido',
    dica: 'Perdido só avisa a Meta quando o motivo da perda está marcado para isso em Minha imobiliária › Listas (ex.: Sem perfil ou sem crédito).',
  },
];

interface LinhaDaRegraProps {
  rotulo: string;
  regra: CapiStageRule;
  aoMudar: (patch: Partial<CapiStageRule>) => void;
  eventos: string[];
  intencoes: string[];
  inputCls: string;
  /** Etapa: "Automático" (desligado, só conta pelo botão no card). Situação: "Ligado". */
  rotuloDoLigado: string;
  dicaDoLigado: string;
  dica?: string;
}

function LinhaDaRegra({
  rotulo, regra: r, aoMudar, eventos, intencoes, inputCls, rotuloDoLigado, dicaDoLigado, dica,
}: LinhaDaRegraProps) {
  const showValue = VALUE_EVENTS.includes(r.event_name);
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-40 shrink-0 truncate text-sm text-foreground">{rotulo}</span>

        <Seletor
          className={inputCls}
          aria-label={`Evento: ${rotulo}`}
          value={r.event_name}
          onChange={(e) => aoMudar({ event_name: e.target.value, enabled: !!e.target.value })}
        >
          <option value="">Não disparar</option>
          {eventos.map((ev) => (
            <option key={ev} value={ev}>
              {CAPI_EVENT_LABELS[ev] ?? ev}
            </option>
          ))}
        </Seletor>

        {r.event_name && (
          <>
            <label className="flex items-center gap-1 text-xs text-muted-foreground" title={dicaDoLigado}>
              <input type="checkbox" checked={r.enabled} onChange={(e) => aoMudar({ enabled: e.target.checked })} />
              {rotuloDoLigado}
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={r.to_client} onChange={(e) => aoMudar({ to_client: e.target.checked })} />
              Cliente
            </label>
            <Seletor
              className={inputCls}
              aria-label={`Público: ${rotulo}`}
              value={r.intent ?? 'none'}
              onChange={(e) => aoMudar({ intent: e.target.value as CapiStageRule['intent'] })}
            >
              {intencoes.map((it) => (
                <option key={it} value={it}>
                  {CAPI_INTENT_LABELS[it] ?? it}
                </option>
              ))}
            </Seletor>

            {showValue && (
              <input
                className={`${inputCls} w-40`}
                value={r.value_field ?? ''}
                onChange={(e) => aoMudar({ value_field: e.target.value || null })}
                placeholder="Valor: card_value"
              />
            )}
          </>
        )}
      </div>
      {dica && <p className="mt-1 text-xs text-muted-foreground">{dica}</p>}
    </div>
  );
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
  const [testEventCode, setTestEventCode] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [stageMap, setStageMap] = useState<Record<string, CapiStageRule>>({});
  const [statusMap, setStatusMap] = useState<Partial<Record<CapiStatusKey, CapiStageRule>>>({});

  // Resultado do "Testar conexão".
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<CapiConnectionTest | null>(null);

  useEffect(() => {
    let alive = true;
    capiConfigService
      .get()
      .then((c) => {
        if (!alive) return;
        setConfig(c);
        setIsEnabled(c.is_enabled);
        setPixelId(c.pixel_id ?? '');
        setTestEventCode(c.test_event_code ?? '');
        setCurrency(c.default_currency || 'BRL');
        setStageMap(c.stage_map || {});
        setStatusMap(c.status_map || {});
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

  function patchStatusRule(chave: CapiStatusKey, patch: Partial<CapiStageRule>) {
    setStatusMap((prev) => ({ ...prev, [chave]: { ...(prev[chave] ?? emptyRule()), ...patch } }));
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
      // A situação vai só com evento escolhido; "Não disparar" tira a chave.
      const cleanStatus: Partial<Record<CapiStatusKey, CapiStageRule>> = {};
      SITUACOES.forEach(({ chave }) => {
        const r = statusMap[chave];
        if (r?.event_name) cleanStatus[chave] = r;
      });
      const updated = await capiConfigService.update({
        is_enabled: isEnabled,
        pixel_id: pixelId.trim() || null,
        ...(accessToken.trim() ? { access_token: accessToken.trim() } : {}),
        test_event_code: testEventCode.trim() || null,
        default_currency: currency,
        stage_map: cleanMap,
        status_map: cleanStatus,
      });
      setConfig(updated);
      setStageMap(updated.stage_map || {});
      setStatusMap(updated.status_map || {});
      setAccessToken('');
      setSaved(true);
    } catch {
      setError('Erro ao salvar. Confira os dados e tente de novo.');
    } finally {
      setSaving(false);
    }
  }

  // Testa a credencial que está NA TELA, não a salva: o erro acontece na hora
  // de colar, e obrigar a salvar antes para descobrir que está errada grava a
  // credencial ruim por cima da que funcionava.
  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await capiConfigService.testConnection({
        pixel_id: pixelId.trim(),
        // Token vazio = usa o que já está gravado (o campo vem em branco quando
        // já existe um token salvo, e isso é proposital).
        ...(accessToken.trim() ? { access_token: accessToken.trim() } : {}),
        test_event_code: testEventCode.trim() || null,
      });
      setTestResult(result);
    } catch {
      setTestResult({
        ok: false,
        can_send: false,
        can_read: false,
        dataset_name: null,
        test_event_visible: false,
        message: 'Não foi possível concluir o teste. Tente de novo em alguns segundos.',
      });
    } finally {
      setTesting(false);
    }
  }

  // Mexeu no campo, o veredito anterior não vale mais.
  function invalidateTest() {
    setTestResult(null);
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }

  const inputCls =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40';
  const labelCls = 'text-sm font-medium text-foreground';

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-sidebar-foreground">Pixel / Conversões (CAPI)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte o pixel deste cliente e escolha o que avisa a Meta: marcar Ganho ou Perdido no card, e o card entrar em cada etapa do funil.
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
            <input
              className={inputCls}
              value={pixelId}
              onChange={(e) => {
                setPixelId(e.target.value);
                invalidateTest();
              }}
              placeholder="Ex: 1543903880225628"
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Token CAPI</label>
            <input
              className={inputCls}
              type="password"
              value={accessToken}
              onChange={(e) => {
                setAccessToken(e.target.value);
                invalidateTest();
              }}
              placeholder={config?.access_token_set ? '•••••• (configurado — deixe vazio p/ manter)' : 'Cole o token da Conversions API'}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Moeda padrão</label>
            <input className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="BRL" />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Código de teste (opcional)</label>
            <input
              className={inputCls}
              value={testEventCode}
              onChange={(e) => {
                setTestEventCode(e.target.value);
                invalidateTest();
              }}
              placeholder="TEST12345 (Events Manager)"
            />
          </div>
        </div>

        {/* Testar conexão — descobrir o problema aqui, não no primeiro lead real. */}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
            >
              {testing ? 'Testando…' : 'Testar conexão'}
            </button>
            <p className="text-xs text-muted-foreground">
              Envia uma conversão de amostra pelo mesmo caminho que o card usa — é o que prova que
              vai funcionar de verdade. A amostra vai sempre em modo de teste, então{' '}
              <strong className="font-medium text-foreground">não entra na medição do cliente</strong>.
              {testEventCode.trim()
                ? ' Com o código de teste preenchido, ela aparece na aba Testar eventos do Gerenciador de Eventos.'
                : ' Preencha o código de teste se quiser vê-la chegando na aba Testar eventos.'}
            </p>
          </div>

          {testResult && (
            <div
              role="status"
              className={`rounded-md border p-3 text-sm ${
                !testResult.ok
                  ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
                  : testResult.can_read
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              }`}
            >
              <p className="font-medium">
                {!testResult.ok
                  ? 'A Meta recusou'
                  : testResult.can_read
                    ? 'Conexão funcionando'
                    : 'Funcionando, com uma ressalva'}
              </p>
              <p className="mt-1">{testResult.message}</p>
              {!testResult.ok && (
                <p className="mt-2 text-xs opacity-80">
                  Confira, nesta ordem: se o token não expirou, se o usuário do sistema dono do token
                  tem o pixel atribuído com <strong>Gerenciar pixel</strong> (não só visualizar), e se
                  o Pixel ID é o desse conjunto. Lembre que as permissões de um token são congeladas
                  quando ele é gerado — se faltava alguma, atribuir depois não resolve: gere um token
                  novo.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Situação do card -> evento (07/10/2026): substitui as etapas finais (Concluída/Cancelada). */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Ao marcar no card → eventos</h2>
          <p className="text-xs text-muted-foreground">
            O evento sai na hora em que alguém marca Ganho ou Perdido no card do lead. Reabrir não avisa a Meta.
          </p>
        </div>
        <div className="divide-y divide-border rounded-lg border border-border">
          {SITUACOES.map(({ chave, rotulo, dica }) => (
            <LinhaDaRegra
              key={chave}
              rotulo={rotulo}
              regra={statusMap[chave] ?? emptyRule()}
              aoMudar={(patch) => patchStatusRule(chave, patch)}
              eventos={eventOptions}
              intencoes={intentOptions}
              inputCls={inputCls}
              rotuloDoLigado="Ligado"
              dicaDoLigado="Desligado: marcar no card não avisa a Meta."
              dica={dica}
            />
          ))}
        </div>
      </section>

      {/* Mapa coluna -> evento */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Colunas do CRM → eventos</h2>
          <p className="text-xs text-muted-foreground">
            Para cada coluna, escolha o evento que dispara quando o card entra nela. Desmarque
            <strong className="mx-1 font-medium text-foreground">Automático</strong>
            se quiser que aquele evento só conte quando alguém clicar no botão
            <strong className="mx-1 font-medium text-foreground">Conversão Meta</strong>
            dentro do card do lead.
          </p>
        </div>

        {(config?.pipelines ?? []).map((pipeline) => (
          <div key={pipeline.id} className="rounded-lg border border-border">
            <div className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">
              {pipeline.name || 'Funil'}
            </div>
            <div className="divide-y divide-border">
              {/* Etapa final pelo tipo (Concluída/Cancelada) não entra: a Meta é avisada ao marcar a situação. */}
              {pipeline.stages.filter((stage) => !stage.final).map((stage) => (
                <LinhaDaRegra
                  key={stage.id}
                  rotulo={stage.name || '—'}
                  regra={rule(stage.id)}
                  aoMudar={(patch) => patchRule(stage.id, patch)}
                  eventos={eventOptions}
                  intencoes={intentOptions}
                  inputCls={inputCls}
                  rotuloDoLigado="Automático"
                  dicaDoLigado="Ligado: envia sozinho quando o card entra nesta coluna. Desligado: só envia pelo botão Conversão Meta dentro do card."
                />
              ))}
              {pipeline.stages.filter((stage) => !stage.final).length === 0 && (
                <div className="px-4 py-3 text-xs text-muted-foreground">Sem colunas neste funil.</div>
              )}
            </div>
          </div>
        ))}

        {(config?.pipelines ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum funil encontrado para este cliente.</p>
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
