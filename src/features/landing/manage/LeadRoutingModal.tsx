import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plug } from 'lucide-react';
import { Seletor } from '@/components/base/Seletor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
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
import { Button, Checkbox, Input, Label as UILabel } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import { CampoDaJanela, GrupoDaJanela } from '@/components/base/janela';

interface Opt {
  id: string;
  label: string;
}

// Os dois campos de lista ficam FORA do componente da janela. Declarados dentro
// do render, eram um componente novo a cada redesenho: o React desmontava e
// montava de novo, e a lista do produto aberta fechava sozinha (e o foco sumia).

/** Lista de evento do Pixel: "Não disparar nada" + os eventos oferecidos. */
function EventField({ id, label, value, onChange, options, hint }: {
  id: string; label: string; value: string; onChange: (v: string) => void; options: string[]; hint?: string;
}) {
  return (
    <CampoDaJanela rotulo={label} htmlFor={id} ajuda={hint}>
      <Seletor id={id} className="w-full" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Não disparar nada</option>
        {options.map((ev) => (
          <option key={ev} value={ev}>{CAPI_EVENT_LABELS[ev] ?? ev}</option>
        ))}
      </Seletor>
    </CampoDaJanela>
  );
}

/** Lista com a opção vazia (o texto de `placeholder`) + as opções. */
function Field({ id, label, value, onChange, options, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; options: Opt[]; placeholder: string;
}) {
  return (
    <CampoDaJanela rotulo={label} htmlFor={id}>
      <Seletor id={id} className="w-full" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </Seletor>
    </CampoDaJanela>
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
          pipelinesService.getPipelines({ include_items: false }),
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
    // Janela da casa. Nem clique fora nem Esc fecham (como antes: perderiam o que
    // foi escolhido e não salvo); o X e o Cancelar fecham.
    <Dialog open onOpenChange={(aberta) => { if (!aberta) onClose(); }}>
      <DialogContent
        className="max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Destino do lead</DialogTitle>
          <DialogDescription className="truncate">Página: {page.title}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : (
          <div className="grid gap-6">
            <GrupoDaJanela titulo="Para onde vai o lead">
              <Field id="rota-funil" label="Funil" value={pipelineId} onChange={onPipeline} options={pipelines} placeholder="Sem funil (só vira contato)" />
              {pipelineId && (
                <Field id="rota-etapa" label="Etapa" value={stageId} onChange={setStageId} options={stages} placeholder="Escolha a etapa" />
              )}
              <Field id="rota-etiqueta" label="Etiqueta" value={labelId} onChange={setLabelId} options={labels} placeholder="Sem etiqueta" />
            </GrupoDaJanela>

            <GrupoDaJanela titulo="Quem assume">
              <CampoDaJanela rotulo="Corretor ou roleta"
                ajuda="Opcional. Escolhendo um corretor, todo lead desta página vai pra ele. Escolhendo uma roleta, o lead é oferecido a um corretor assim que chega: ele recebe o aviso no WhatsApp e no app, e vira o responsável quando aceita. Deixando vazio, nada muda: o lead entra no funil sem responsável e a gestão distribui na mão.">
                <CampoQuemAssume
                  aria-label="Quem assume o lead"
                  value={quem}
                  onChange={setQuem}
                  pessoas={pessoas}
                  roletas={roletas}
                  nenhum="Ninguém (entra sem responsável)"
                />
              </CampoDaJanela>
              {roletaId && (
                <Aviso tom="info" compacto>
                  {'Lead que já tem responsável não volta para o sorteio: continua com quem já o atende. Fora do horário da roleta, o lead espera e é oferecido quando ela abrir.'}
                </Aviso>
              )}
            </GrupoDaJanela>

            <GrupoDaJanela titulo="Se for desqualificado">
              <p className="text-xs text-muted-foreground">Opcional. Deixe vazio para usar o mesmo destino de cima.</p>
              <Field id="rota-desq-funil" label="Funil" value={disqPipelineId} onChange={onDisqPipeline} options={pipelines} placeholder="Mesmo de cima" />
              {disqPipelineId && (
                <Field id="rota-desq-etapa" label="Etapa" value={disqStageId} onChange={setDisqStageId} options={disqStages} placeholder="Escolha a etapa" />
              )}
              <Field id="rota-desq-etiqueta" label="Etiqueta" value={disqLabelId} onChange={setDisqLabelId} options={labels} placeholder="Sem etiqueta" />
            </GrupoDaJanela>

            <GrupoDaJanela titulo="Rastreio">
              <p className="text-xs text-muted-foreground">
                Cada evento sai duas vezes, pelo navegador de quem preenche e pelo servidor, com o
                mesmo identificador. Assim a Meta conta uma conversão só, e o envio continua
                chegando quando o navegador bloqueia o pixel.
              </p>

              <CampoDaJanela rotulo="Enviar para" htmlFor="rota-pixel-modo">
                <Seletor id="rota-pixel-modo" className="w-full" value={pixel.mode} onChange={(e) => setPixelField('mode', e.target.value as PixelForm['mode'])}>
                  <option value="off">Não rastrear esta página</option>
                  <option value="crm">
                    {crmPixelId
                      ? `Pixel da conta — ${crmPixelId}`
                      : 'Pixel da conta (nenhum cadastrado ainda)'}
                  </option>
                  <option value="custom">Outro pixel (só desta página)</option>
                </Seletor>
              </CampoDaJanela>

              {pixel.mode === 'crm' && !crmPixelId && (
                <Aviso tom="atencao" compacto>
                  Cadastre o pixel e a chave de acesso em Automações, na tela Pixel e CAPI. Sem isso nada é enviado.
                </Aviso>
              )}

              {pixel.mode === 'custom' && (
                <CampoDaJanela rotulo="Número do pixel" htmlFor="rota-pixel-id"
                  ajuda="O envio pelo servidor usa a chave de acesso cadastrada em Pixel e CAPI. Se ela não tiver acesso a este pixel, a Meta recusa: teste antes de subir o anúncio.">
                  <Input id="rota-pixel-id" value={pixel.pixelId} onChange={(e) => setPixelField('pixelId', e.target.value)}
                    placeholder="Ex.: 123456789012345" />
                </CampoDaJanela>
              )}

              {pixel.mode !== 'off' && (
                <>
                  <div className="flex items-center gap-2">
                    <Checkbox id="rota-pageview" checked={pixel.pageView}
                      onCheckedChange={(c) => setPixelField('pageView', c === true)} />
                    <UILabel htmlFor="rota-pageview" className="cursor-pointer text-sm font-normal">Contar quem abre a página</UILabel>
                  </div>
                  <EventField id="rota-evento-envio" options={eventOptions} label="Quando o formulário é enviado" value={pixel.submitEvent}
                    onChange={(v) => setPixelField('submitEvent', v)} />
                  <EventField id="rota-evento-aprova" options={eventOptions} label="Quando a régua do formulário aprova" value={pixel.qualifiedEvent}
                    onChange={(v) => setPixelField('qualifiedEvent', v)}
                    hint="Escolher o mesmo evento que o corretor usa no card faz o mesmo lead contar duas vezes como qualificado." />
                  <EventField id="rota-evento-reprova" options={eventOptions} label="Quando a régua do formulário reprova" value={pixel.disqualifiedEvent}
                    onChange={(v) => setPixelField('disqualifiedEvent', v)} />

                  <div className="grid justify-items-start gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={testConnection} disabled={testing || !activePixelId}>
                      {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plug className="mr-1.5 h-3.5 w-3.5" />}
                      Testar conexão
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {activePixelId ? 'O teste envia um evento de teste à Meta.' : 'Escolha um pixel para poder testar.'}
                    </p>
                    {testResult && (
                      <Aviso tom={testResult.ok ? 'sucesso' : 'erro'} compacto className="w-full">
                        {`${testResult.ok ? 'Consegui enviar o lead. ' : 'Não consegui enviar. '}${testResult.message ?? ''}`}
                      </Aviso>
                    )}
                  </div>
                </>
              )}
            </GrupoDaJanela>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
              <Button type="button" onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
