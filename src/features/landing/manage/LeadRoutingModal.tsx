import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plug, X } from 'lucide-react';
import { Seletor } from '@/components/base/Seletor';
import { labelsService } from '@/services/contacts/labelsService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import {
  landingPageService,
  type LandingPageDTO,
} from '@/services/landingPages/landingPageService';
import {
  capiConfigService,
  CAPI_EVENT_LABELS,
  type CapiConfig,
  type CapiConnectionTest,
} from '@/services/capi/capiConfigService';
import {
  roletaConfigService,
  type RoletaConfig,
} from '@/services/roletaConfig/roletaConfigService';
import CampoQuemAssume, { type PessoaDaLista, type QuemAssume } from '@/components/roleta/CampoQuemAssume';
import usersService from '@/services/users/usersService';
import { useClientToggle } from '@/contexts/TenantFeaturesContext';
import {
  buildLandingSettings,
  readDefaultAssigneeId,
  readDisqualifiedBranch,
  readRoletaConfigId,
} from './landingRouting';
import {
  effectivePixelId,
  readPixelSettings,
  writePixelSettings,
  type PixelForm,
  type StoredPixel,
} from './landingPixel';

interface Opt {
  id: string;
  label: string;
}

// Os dois campos de lista ficam FORA do componente da janela. Declarados dentro
// do render, eram um componente novo a cada redesenho: o React desmontava e
// montava de novo, e a lista do produto aberta fechava sozinha (e o foco sumia).

/** Lista de evento do Pixel: "Não disparar nada" + os eventos oferecidos. */
function EventField({ label, value, onChange, options, hint }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <Seletor value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary">
        <option value="">Não disparar nada</option>
        {options.map((ev) => (
          <option key={ev} value={ev}>{CAPI_EVENT_LABELS[ev] ?? ev}</option>
        ))}
      </Seletor>
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Lista com a opção vazia (o texto de `placeholder`) + as opções. */
function Field({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; options: Opt[]; placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <Seletor value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary">
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </Seletor>
    </label>
  );
}

/** Config por landing: pra qual pipeline/coluna o lead cai e qual tag recebe. */
export default function LeadRoutingModal({
  siteId,
  page,
  onClose,
  onSaved,
}: {
  siteId: string;
  page: LandingPageDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const storedSettings = page.settings ?? {};
  const disqInit = readDisqualifiedBranch(storedSettings);
  const [pipelines, setPipelines] = useState<Opt[]>([]);
  const [stages, setStages] = useState<Opt[]>([]);
  const [labels, setLabels] = useState<Opt[]>([]);
  const [pipelineId, setPipelineId] = useState(page.lead_pipeline_id ?? '');
  const [stageId, setStageId] = useState(page.lead_stage_id ?? '');
  const [labelId, setLabelId] = useState(page.lead_label_id ?? '');
  // Ramo desqualificado (opcional): se vazio, cai no roteamento padrão acima.
  const [disqStages, setDisqStages] = useState<Opt[]>([]);
  const [disqPipelineId, setDisqPipelineId] = useState(disqInit.pipeline_id ?? '');
  const [disqStageId, setDisqStageId] = useState(disqInit.stage_id ?? '');
  const [disqLabelId, setDisqLabelId] = useState(disqInit.label_id ?? '');
  // Quem assume o lead (opcional): um corretor fixo (`routing.default_assignee_id`)
  // OU uma roleta (`routing.roleta_config_id`). Vazio = o lead entra sem
  // responsável, que é como toda landing sempre funcionou. TODAS as roletas: a
  // escolhida e desligada continua na lista. `null` = cargo sem acesso.
  const [roletas, setRoletas] = useState<RoletaConfig[] | null>(null);
  const [pessoas, setPessoas] = useState<PessoaDaLista[] | null>(null);
  const roletaNova = useClientToggle('roleta_nova');
  const assigneeGravado = readDefaultAssigneeId(storedSettings);
  const [quem, setQuem] = useState<QuemAssume>({
    default_assignee_id: assigneeGravado || null,
    roleta_config_id: readRoletaConfigId(storedSettings) || null,
  });
  const roletaId = quem.roleta_config_id ?? '';
  // Rastreio (Pixel Meta) da landing. Os eventos saem pelo navegador do lead E
  // pela API de Conversões, com o mesmo identificador — quem manda pelo servidor
  // é o backend, na captura.
  const [pixel, setPixel] = useState<PixelForm>(() =>
    readPixelSettings((page.settings as { pixel?: StoredPixel } | null)?.pixel),
  );
  const setPixelField = <K extends keyof PixelForm>(key: K, value: PixelForm[K]) =>
    setPixel((p) => ({ ...p, [key]: value }));
  // Config de Pixel e CAPI do cliente: de onde sai o pixel do dropdown e o token
  // que o envio pelo servidor usa. Leitura de fundo — recusa por cargo aqui não
  // grita, só esconde a opção de herdar.
  const [crmCapi, setCrmCapi] = useState<CapiConfig | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<CapiConnectionTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchStages = async (pid: string) => {
    const res = await pipelinesService.getPipelineStages(pid);
    return ((res?.data ?? []) as Array<{ id: string; name: string }>).map((s) => ({ id: s.id, label: s.name }));
  };
  const loadStages = async (pid: string, active = true) => {
    const ss = await fetchStages(pid);
    if (active) setStages(ss);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Pelo serviço de etiquetas, nunca pela rota crua: a lista é
        // PAGINADA (20 por página por padrão), e quem tem mais que isso via os
        // dois seletores de Tag (o normal e o do desqualificado) cortados no meio
        // do alfabeto, sem nada dizendo por quê.
        const [pRes, lRes] = await Promise.all([
          pipelinesService.getPipelines(),
          labelsService.getLabels(),
        ]);
        if (!active) return;
        const ps = (pRes?.data ?? []) as Array<{ id: string; name: string }>;
        setPipelines(ps.map((p) => ({ id: p.id, label: p.name })));
        setLabels((lRes.data ?? []).map((l) => ({ id: String(l.id), label: l.title })));
        if (page.lead_pipeline_id) await loadStages(page.lead_pipeline_id, active);
        if (disqInit.pipeline_id) {
          const ss = await fetchStages(disqInit.pipeline_id);
          if (active) setDisqStages(ss);
        }
        // Fora do Promise.all e engolindo o erro de propósito: sem esta config a
        // janela inteira continua funcionando — só não oferece herdar o pixel.
        try {
          const capi = await capiConfigService.get();
          if (active) setCrmCapi(capi);
        } catch {
          /* leitura de fundo não grita */
        }
        // Idem: cargo sem acesso às roletas (ou à equipe) só não vê aquela aba.
        try {
          const rs = await roletaConfigService.getAll();
          if (active) setRoletas(rs || []);
        } catch {
          /* leitura de fundo não grita */
        }
        try {
          const us = await usersService.getUsers();
          if (active) {
            setPessoas((us.data ?? []).filter((u) => !u.deactivated).map((u) => ({ id: String(u.id), nome: u.name })));
          }
        } catch {
          /* leitura de fundo não grita */
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPipeline = async (pid: string) => {
    setPipelineId(pid);
    setStageId('');
    setStages([]);
    if (pid) await loadStages(pid);
  };

  const onDisqPipeline = async (pid: string) => {
    setDisqPipelineId(pid);
    setDisqStageId('');
    setDisqStages([]);
    if (pid) setDisqStages(await fetchStages(pid));
  };

  const save = async () => {
    setSaving(true);
    try {
      const hasDisq = disqPipelineId || disqStageId || disqLabelId;
      const settings = buildLandingSettings(
        storedSettings,
        {
          disqualified: hasDisq
            ? {
                pipeline_id: disqPipelineId || null,
                stage_id: disqStageId || null,
                label_id: disqLabelId || null,
              }
            : null,
          roletaConfigId: quem.roleta_config_id,
          // Só viaja o que a pessoa pôde ver: sem a lista de pessoas (cargo sem
          // acesso) e sem corretor gravado, a chave nem é escrita.
          defaultAssigneeId: pessoas !== null || assigneeGravado ? quem.default_assignee_id : undefined,
        },
        writePixelSettings(pixel),
      );
      await landingPageService.saveRouting(
        siteId,
        page.id,
        {
          lead_pipeline_id: pipelineId || null,
          lead_stage_id: stageId || null,
          lead_label_id: labelId || null,
        },
        settings,
      );
      toast.success('Roteamento salvo');
      onSaved();
    } catch {
      toast.error('Erro ao salvar roteamento');
    } finally {
      setSaving(false);
    }
  };

  // O pixel que vai ser usado de verdade — é ele que o teste pergunta à Meta.
  const crmPixelId = crmCapi?.pixel_id ?? null;
  const activePixelId = effectivePixelId(pixel, crmPixelId);

  // Eventos oferecidos: os que o CRM já conhece (os mesmos do mapa de colunas em
  // Pixel e CAPI) mais o que esta landing já usa, se for um nome de fora — senão
  // abrir a janela apagaria em silêncio o evento que está rodando no anúncio.
  const eventOptions = (() => {
    const known = crmCapi?.known_events?.length
      ? crmCapi.known_events
      : ['Lead', 'Qualificado', 'Desqualificado', 'Schedule', 'Contact', 'Purchase'];
    const emUso = [pixel.submitEvent, pixel.qualifiedEvent, pixel.disqualifiedEvent].filter(
      (e) => e && !known.includes(e),
    );
    return [...known, ...new Set(emUso)];
  })();

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // O token é sempre o de Pixel e CAPI: a landing não tem token próprio.
      // Sem pixel_id no corpo, o servidor testa o que está gravado lá.
      const res = await capiConfigService.testConnection(
        pixel.mode === 'custom' && activePixelId ? { pixel_id: activePixelId } : {},
      );
      setTestResult(res);
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } | string; message?: string } } };
      const data = err.response?.data;
      // A API tem dois formatos de erro; ler só um faz a recusa por cargo virar
      // frase genérica.
      const motivo =
        (typeof data?.error === 'object' ? data?.error?.message : undefined) ??
        (typeof data?.error === 'string' ? data?.message : undefined) ??
        'Não consegui falar com o servidor agora.';
      setTestResult({
        ok: false, can_send: false, can_read: false, dataset_name: null,
        test_event_visible: false, message: motivo,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5">
        <div className="mb-1 flex items-start justify-between">
          <h2 className="text-base font-semibold">Roteamento de lead</h2>
          <button type="button" aria-label="Fechar" onClick={onClose} className="text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-4 truncate text-xs text-muted-foreground">Landing: {page.title}</p>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : (
          <div className="space-y-3">
            <Field label="Pipeline" value={pipelineId} onChange={onPipeline} options={pipelines} placeholder="Sem pipeline (só vira contato)" />
            {pipelineId && (
              <Field label="Coluna (estágio)" value={stageId} onChange={setStageId} options={stages} placeholder="Escolha a coluna" />
            )}
            <Field label="Tag" value={labelId} onChange={setLabelId} options={labels} placeholder="Sem tag" />

            <div className="mt-2 border-t border-border pt-3">
              <p className="mb-0.5 text-sm font-medium">Quem assume o lead (opcional)</p>
              <p className="mb-2 text-xs text-muted-foreground">
                Escolhendo um corretor, todo lead desta landing vai pra ele. Escolhendo uma
                roleta, o lead é oferecido a um corretor assim que chega — ele recebe o aviso
                no WhatsApp e no app, e vira o responsável quando aceita. Deixando vazio, nada
                muda: o lead entra no funil sem responsável e a gestão distribui na mão.
              </p>
              <span className="mb-1 block text-xs text-muted-foreground">Corretor ou roleta</span>
              <CampoQuemAssume
                aria-label="Quem assume o lead"
                value={quem}
                onChange={setQuem}
                pessoas={pessoas}
                roletas={roletas}
                nenhum="Ninguém (entra sem responsável)"
              />
              {roletaId && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Lead que já tem responsável não volta para o sorteio — continua com quem já o
                  atende.{' '}
                  {roletaNova
                    ? 'Fora do horário da roleta, o lead espera e é oferecido quando ela abrir.'
                    : 'Fora do horário da roleta, quem recebe é o número de plantão dela.'}
                </p>
              )}
            </div>

            <div className="mt-2 border-t border-border pt-3">
              <p className="mb-0.5 text-sm font-medium">Se o lead for desqualificado (opcional)</p>
              <p className="mb-2 text-xs text-muted-foreground">Deixe vazio para usar o mesmo roteamento acima.</p>
              <div className="space-y-3">
                <Field label="Pipeline" value={disqPipelineId} onChange={onDisqPipeline} options={pipelines} placeholder="Mesmo de cima" />
                {disqPipelineId && (
                  <Field label="Coluna (estágio)" value={disqStageId} onChange={setDisqStageId} options={disqStages} placeholder="Escolha a coluna" />
                )}
                <Field label="Tag" value={disqLabelId} onChange={setDisqLabelId} options={labels} placeholder="Sem tag" />
              </div>
            </div>

            <div className="mt-2 border-t border-border pt-3">
              <p className="mb-0.5 text-sm font-medium">Rastreio (Pixel Meta)</p>
              <p className="mb-2 text-xs text-muted-foreground">
                Cada evento sai duas vezes — pelo navegador do lead e pelo servidor (API de
                Conversões) — com o mesmo identificador, então a Meta conta uma conversão só.
                O servidor é o que continua chegando quando o navegador do lead bloqueia o Pixel.
              </p>

              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Enviar para</span>
                <Seletor value={pixel.mode} onChange={(e) => setPixelField('mode', e.target.value as PixelForm['mode'])}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary">
                  <option value="off">Não rastrear esta landing</option>
                  <option value="crm">
                    {crmPixelId
                      ? `Pixel do CRM — ${crmPixelId}`
                      : 'Pixel do CRM (nenhum cadastrado ainda)'}
                  </option>
                  <option value="custom">Outro pixel (só desta landing)</option>
                </Seletor>
              </label>

              {pixel.mode === 'crm' && !crmPixelId && (
                <p className="mt-1 text-[11px] text-amber-600">
                  Cadastre o Pixel e o Token em Automações → Pixel e CAPI. Sem isso nada é enviado.
                </p>
              )}

              {pixel.mode === 'custom' && (
                <>
                  <label className="mt-2 block">
                    <span className="mb-1 block text-xs text-muted-foreground">ID do Pixel</span>
                    <input value={pixel.pixelId} onChange={(e) => setPixelField('pixelId', e.target.value)}
                      placeholder="Ex: 123456789012345"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                  </label>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    O envio pelo servidor usa o Token cadastrado em Pixel e CAPI. Se ele não tiver
                    acesso a este conjunto, a Meta recusa — teste antes de subir o anúncio.
                  </p>
                </>
              )}

              {pixel.mode !== 'off' && (
                <div className="mt-3 space-y-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="checkbox" checked={pixel.pageView}
                      onChange={(e) => setPixelField('pageView', e.target.checked)} />
                    Contar quem abre a página (PageView)
                  </label>
                  <EventField options={eventOptions} label="Quando o formulário é enviado" value={pixel.submitEvent}
                    onChange={(v) => setPixelField('submitEvent', v)} />
                  <EventField options={eventOptions} label="Quando a régua do formulário aprova" value={pixel.qualifiedEvent}
                    onChange={(v) => setPixelField('qualifiedEvent', v)}
                    hint="Escolher o mesmo evento que o corretor usa no card faz o mesmo lead contar duas vezes como qualificado." />
                  <EventField options={eventOptions} label="Quando a régua do formulário reprova" value={pixel.disqualifiedEvent}
                    onChange={(v) => setPixelField('disqualifiedEvent', v)} />

                  <div className="pt-1">
                    <button type="button" onClick={testConnection} disabled={testing || !activePixelId}
                      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-40">
                      {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                      Testar conexão
                    </button>
                    {!activePixelId && (
                      <p className="mt-1 text-[11px] text-muted-foreground">Escolha um pixel para poder testar.</p>
                    )}
                    {testResult && (
                      <p className={`mt-2 text-[11px] ${testResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                        {testResult.ok ? 'Consegui enviar o lead. ' : 'Não consegui enviar. '}
                        {testResult.message}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-muted-foreground">Cancelar</button>
              <button type="button" onClick={save} disabled={saving}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
