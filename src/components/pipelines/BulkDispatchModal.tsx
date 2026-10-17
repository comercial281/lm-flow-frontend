import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { plural, telefone } from '@/lib/formato';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ds';
import {
  Megaphone,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  Paperclip,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { PipelineStage } from '@/types/analytics';
import {
  broadcastsService,
  BroadcastSequenceItem,
  AudienceMode,
  AudiencePreviewFull,
  BroadcastChannelKind,
  BroadcastTemplateConfig,
  CloudChannelOption,
  SenderOption,
} from '@/services/broadcasts/broadcastsService';
import { labelsService } from '@/services/contacts/labelsService';
import type { Label as LabelType } from '@/types/settings';
import { tenantTemplateVariablesService } from '@/services/messageFunnels/messageFunnelsService';
import type { TemplateVariable } from '@/types/messageFunnels';
import { type SequenceDraftItem, newSequenceItem } from '@/components/messaging/MessageSequenceEditor';

import { PhoneInput } from '@/components/shared/PhoneInput';
import Aviso from '@/components/base/Aviso';
import { CaixaDaJanela, CampoDaJanela, GradeDaJanela, GrupoDaJanela } from '@/components/base/janela';
import PassoQuemRecebe from './disparo/PassoQuemRecebe';
import PassoMensagem, { type ModoDoEnvio } from './disparo/PassoMensagem';
interface BulkDispatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  pipelineName?: string;
  stages: PipelineStage[];
}

type Step = 'audience' | 'messages' | 'cadence' | 'review' | 'creating' | 'done';

// contact/sticker/property_book entram só pra satisfazer o tipo (SequenceDraftItem
// cobre os tipos do editor compartilhado) — nunca aparecem aqui de verdade: o
// editor exclui contact/sticker nesta tela (excludeKinds) e o book só aparece
// com `extraKinds`, que o disparo não passa.
const KIND_LABEL: Record<SequenceDraftItem['kind'], string> = {
  text: 'Texto',
  image: 'Imagem',
  audio: 'Áudio',
  video: 'Vídeo',
  document: 'Documento',
  delay: 'Aguardar',
  contact: 'Contato',
  sticker: 'Figurinha',
  property_book: 'Book do imóvel',
};

// Preview substituindo {{nome}} por um exemplo só na revisão.
function preview(text: string, name = 'Giovani') {
  return text.replace(/\{\{?\s*nome\s*\}?\}/gi, name);
}

function itemIsValid(it: SequenceDraftItem) {
  if (it.kind === 'delay') return true; // item de espera é sempre válido
  return it.kind === 'text' ? (it.text_content ?? '').trim() !== '' : !!it.media_url;
}

// Converte os itens do editor no payload de sequência do backend. `contact`/
// `sticker` não têm rota no disparo em massa ainda (`excludeKinds` no editor
// já impede escolher esses tipos aqui) — filtra de novo por segurança, caso
// um item desses sobreviva de uma edição anterior salva antes da exclusão.
function toSequencePayload(items: SequenceDraftItem[]): BroadcastSequenceItem[] {
  return items
    .filter((it): it is SequenceDraftItem & { kind: BroadcastSequenceItem['kind'] } =>
      it.kind !== 'contact' && it.kind !== 'sticker' && it.kind !== 'property_book')
    .map((it, idx) => {
      const variations = (it.text_variations ?? []).map(s => s.trim()).filter(Boolean);
      return {
        position: idx,
        kind: it.kind,
        text_content: it.text_content,
        ...(variations.length ? { text_variations: variations } : {}),
        media_url: it.media_url,
        media_caption: it.media_caption,
        media_filename: it.media_filename,
        delay_seconds: it.delay_seconds,
      };
    });
}

export default function BulkDispatchModal({
  open,
  onOpenChange,
  pipelineId,
  pipelineName,
  stages,
}: BulkDispatchModalProps) {
  const [step, setStep] = useState<Step>('audience');

  // Por onde sai: 'evolution' (Campanha direta) ou 'whatsapp_cloud' (modelo oficial).
  const [channelKind, setChannelKind] = useState<BroadcastChannelKind>('evolution');
  // Números de saída da Campanha direta (null = carregando).
  const [senderOptions, setSenderOptions] = useState<SenderOption[] | null>(null);
  const [senderInboxId, setSenderInboxId] = useState('');
  const [erroNumeros, setErroNumeros] = useState(false);
  const ultimaCargaNumeros = useRef(0);

  // Audiência
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('pipeline');
  const [stageId, setStageId] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [availableLabels, setAvailableLabels] = useState<LabelType[]>([]);
  // Etiquetas e canais oficiais: falha ao carregar não vira "Nenhuma … cadastrada/conectada".
  const [erroEtiquetas, setErroEtiquetas] = useState(false);
  const [erroCanais, setErroCanais] = useState(false);
  const ultimaCargaEtiquetas = useRef(0);
  const ultimaCargaCanais = useRef(0);
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreviewFull | null>(null);
  const [erroPrevia, setErroPrevia] = useState(false);
  const [countingAudience, setCountingAudience] = useState(false);
  const recipientCount = audiencePreview?.count ?? null;

  // O que mandar: sequência (MESMO editor do funil) ou funil pronto (o lead entra nele).
  const [sendMode, setSendMode] = useState<ModoDoEnvio>('message');
  const [flowId, setFlowId] = useState('');
  const [flowName, setFlowName] = useState('');
  const [items, setItems] = useState<SequenceDraftItem[]>([newSequenceItem()]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);

  // Modelo oficial (WhatsApp Cloud).
  const [cloudOptions, setCloudOptions] = useState<CloudChannelOption[]>([]);
  const [cloudInboxId, setCloudInboxId] = useState('');
  const [cloudTemplateName, setCloudTemplateName] = useState('');
  const [cloudVars, setCloudVars] = useState<Record<string, string>>({});

  // Nome do envio (vai pro registro/LOG e pra lista de disparos)
  const [campaignName, setCampaignName] = useState('');

  // Destino pós-envio (opcional): mover pra etapa + criar/aplicar tag
  const [postStageId, setPostStageId] = useState('');
  const [postLabel, setPostLabel] = useState('');

  // Cadência (o passo Ritmo troca isso pelos pacotes na próxima tarefa).
  const [minS, setMinS] = useState(4);
  const [maxS, setMaxS] = useState(8);
  const [batchSize, setBatchSize] = useState(10);
  const [pauseS, setPauseS] = useState(60);
  const [businessHours, setBusinessHours] = useState(true);
  // Fase 4/5: teto de gasto (R$), respeitar opt-out, frequency cap (dias).
  const [maxSpend, setMaxSpend] = useState('');
  const [respectOptOut, setRespectOptOut] = useState(true);
  const [frequencyCapDays, setFrequencyCapDays] = useState(0);

  // Teste
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);

  const [creating, setCreating] = useState(false);

  const resetWizard = useCallback(() => {
    setStep('audience');
    setChannelKind('evolution');
    setSenderInboxId('');
    setAudienceMode('pipeline');
    setStageId('');
    setSelectedLabels([]);
    setAudiencePreview(null);
    setErroPrevia(false);
    setSendMode('message');
    setFlowId('');
    setFlowName('');
    setItems([newSequenceItem()]);
    setCloudInboxId('');
    setCloudTemplateName('');
    setCloudVars({});
    setCampaignName('');
    setPostStageId('');
    setPostLabel('');
    setMinS(4);
    setMaxS(8);
    setBatchSize(10);
    setPauseS(60);
    setBusinessHours(true);
    setMaxSpend('');
    setRespectOptOut(true);
    setFrequencyCapDays(0);
    setTestPhone('');
  }, []);

  const carregarNumeros = useCallback(() => {
    const vez = ++ultimaCargaNumeros.current;
    setErroNumeros(false);
    setSenderOptions(null);
    broadcastsService
      .senderOptions()
      .then(({ data, default_inbox_id }) => {
        if (vez !== ultimaCargaNumeros.current) return;
        setSenderOptions(data);
        // O padrão da conta já marcado; se ele não puder disparar, o primeiro que pode.
        const padrao = data.find(o => o.inbox_id === default_inbox_id && o.sendable) ?? data.find(o => o.sendable);
        setSenderInboxId(atual => atual || padrao?.inbox_id || '');
      })
      .catch(() => {
        if (vez !== ultimaCargaNumeros.current) return;
        setSenderOptions([]);
        setErroNumeros(true);
      });
  }, []);

  const carregarEtiquetas = useCallback(() => {
    const vez = ++ultimaCargaEtiquetas.current;
    setErroEtiquetas(false);
    labelsService
      .getLabels()
      .then(res => {
        if (vez === ultimaCargaEtiquetas.current) setAvailableLabels(Array.isArray(res.data) ? (res.data as LabelType[]) : []);
      })
      .catch(() => {
        if (vez !== ultimaCargaEtiquetas.current) return;
        setAvailableLabels([]);
        setErroEtiquetas(true);
      });
  }, []);

  const carregarCanais = useCallback(() => {
    const vez = ++ultimaCargaCanais.current;
    setErroCanais(false);
    broadcastsService
      .whatsappCloudOptions()
      .then(c => { if (vez === ultimaCargaCanais.current) setCloudOptions(c); })
      .catch(() => {
        if (vez !== ultimaCargaCanais.current) return;
        setCloudOptions([]);
        setErroCanais(true);
      });
  }, []);

  // Ao abrir: zera a janela e carrega números, etiquetas, variáveis e canais oficiais.
  useEffect(() => {
    if (!open) return;
    resetWizard();
    carregarNumeros();
    carregarEtiquetas();
    tenantTemplateVariablesService
      .list()
      .then(res => {
        setVariables([
          ...res.builtin,
          ...res.custom.map(v => ({
            token: v.token,
            placeholder: v.placeholder,
            label: v.label,
            description: v.description,
            builtin: false,
          })),
        ]);
      })
      .catch(() =>
        setVariables([
          { token: 'nome', placeholder: '{{nome}}', label: 'Nome', builtin: true },
          { token: 'telefone', placeholder: '{{telefone}}', label: 'Telefone', builtin: true },
          { token: 'email', placeholder: '{{email}}', label: 'E-mail', builtin: true },
        ]),
      );
    carregarCanais();
  }, [open, resetWizard, carregarNumeros, carregarEtiquetas, carregarCanais]);

  const cloudMode = channelKind === 'whatsapp_cloud';
  const selectedCloudInbox = useMemo(
    () => cloudOptions.find(o => o.inbox_id === cloudInboxId) || cloudOptions[0],
    [cloudOptions, cloudInboxId],
  );
  const selectedCloudTemplate = useMemo(
    () => selectedCloudInbox?.templates.find(t => t.name === cloudTemplateName),
    [selectedCloudInbox, cloudTemplateName],
  );
  const selectedSender = useMemo(
    () => senderOptions?.find(o => o.inbox_id === senderInboxId),
    [senderOptions, senderInboxId],
  );

  // Conta quem recebe com o número de saída: lead de outro corretor depende dele.
  const audiencePayload = useMemo(
    () => ({
      mode: audienceMode,
      stage_id: audienceMode === 'stage' ? stageId : undefined,
      labels: audienceMode === 'tag' ? selectedLabels : undefined,
    }),
    [audienceMode, stageId, selectedLabels],
  );
  const previewInboxId = cloudMode ? selectedCloudInbox?.inbox_id : senderInboxId || undefined;
  // Campanha direta: espera os números chegarem (senão conta duas vezes, sem e com o número).
  const esperandoNumeros = !cloudMode && senderOptions === null;
  useEffect(() => {
    if (!open) return;
    setErroPrevia(false);
    // A contagem anterior foi descartada pela limpeza: não deixa o "Contando" preso.
    setCountingAudience(false);
    if ((audienceMode === 'stage' && !stageId) || (audienceMode === 'tag' && selectedLabels.length === 0)) {
      setAudiencePreview(null);
      return;
    }
    if (esperandoNumeros) return;
    let alive = true;
    setCountingAudience(true);
    broadcastsService
      .audiencePreviewFull(pipelineId, audiencePayload, previewInboxId)
      .then(r => { if (alive) setAudiencePreview(r); })
      .catch(() => {
        if (!alive) return;
        setAudiencePreview(null);
        setErroPrevia(true);
      })
      .finally(() => { if (alive) setCountingAudience(false); });
    return () => {
      alive = false;
    };
  }, [open, pipelineId, audienceMode, stageId, selectedLabels, audiencePayload, previewInboxId, esperandoNumeros]);

  const itemsValid = useMemo(() => items.length > 0 && items.every(itemIsValid), [items]);

  // Canal oficial (WhatsApp Cloud): exige template aprovado + variáveis preenchidas.
  const cloudVarsFilled = useMemo(
    () => (selectedCloudTemplate?.variables ?? []).every(v => (cloudVars[v] ?? '').trim() !== ''),
    [selectedCloudTemplate, cloudVars],
  );
  // Estimativa de custo do disparo oficial (Fase 4). Tarifas BRL de referência
  // Brasil por categoria — o backend é a fonte de verdade pro budget cap.
  const costEstimate = useMemo(() => {
    if (channelKind !== 'whatsapp_cloud' || !recipientCount) return null;
    const cat = (selectedCloudTemplate?.category ?? 'marketing').toLowerCase();
    const rates: Record<string, number> = {
      marketing: 0.35, utility: 0.02, authentication: 0.16, service: 0,
    };
    const rate = rates[cat] ?? rates.marketing;
    return { cat, rate, total: recipientCount * rate };
  }, [channelKind, recipientCount, selectedCloudTemplate]);
  const buildTemplateConfig = useCallback(
    (): BroadcastTemplateConfig => ({
      inbox_id: selectedCloudInbox?.inbox_id,
      template_name: selectedCloudTemplate?.name ?? '',
      language: selectedCloudTemplate?.language,
      parameters: (selectedCloudTemplate?.variables ?? []).map(v => cloudVars[v] ?? ''),
    }),
    [selectedCloudInbox, selectedCloudTemplate, cloudVars],
  );

  const flowMode = !cloudMode && sendMode === 'flow';
  const step1Ok = (recipientCount ?? 0) > 0 && (cloudMode ? cloudOptions.length > 0 : !!selectedSender?.sendable);
  const step2Ok = cloudMode
    ? !!selectedCloudInbox && !!selectedCloudTemplate && !!selectedCloudTemplate.approved && cloudVarsFilled
    : flowMode
      ? !!flowId
      : itemsValid;
  const step3Ok = minS >= 2 && maxS >= minS && batchSize >= 1 && batchSize <= 50 && pauseS >= 10;

  const sumItemDelays = useMemo(
    () => (flowMode ? 0 : items.reduce((acc, it) => acc + (it.delay_seconds || 0), 0)),
    [items, flowMode],
  );

  const estDurationMin = useMemo(() => {
    const n = recipientCount ?? 0;
    if (!n) return 0;
    const avg = (minS + maxS) / 2;
    const pauses = Math.max(0, Math.ceil(n / batchSize) - 1);
    return Math.round((n * (avg + sumItemDelays) + pauses * pauseS) / 60);
  }, [recipientCount, minS, maxS, batchSize, pauseS, sumItemDelays]);

  const handleTest = async () => {
    const phone = testPhone.replace(/\D/g, '');
    if (phone.length < 10) {
      toast.error('Número inválido (use DDD + número, ex: 5511999999999).');
      return;
    }
    if (cloudMode) {
      if (!step2Ok) {
        toast.error('Escolha um modelo aprovado e preencha as variáveis.');
        return;
      }
    } else if (!itemsValid) {
      toast.error('Monte a sequência antes de testar.');
      return;
    }
    setTesting(true);
    try {
      if (cloudMode) {
        await broadcastsService.testSendTemplate(phone, buildTemplateConfig());
      } else {
        await broadcastsService.testSendSequence(phone, toSequencePayload(items));
      }
      toast.success('Teste enviado! Confere o WhatsApp.');
    } catch (err: any) {
      toast.error(err?.response?.data?.errors?.[0] || 'Falha ao enviar o teste.');
    } finally {
      setTesting(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (step === 'creating') return;
    onOpenChange(v);
  };

  const handleCreate = async () => {
    setCreating(true);
    setStep('creating');
    try {
      await broadcastsService.create({
        name: campaignName.trim() || undefined,
        pipeline_id: pipelineId,
        channel_kind: channelKind,
        template_config: cloudMode ? buildTemplateConfig() : undefined,
        // Campanha direta: o número de saída escolhido.
        inbox_id: cloudMode ? undefined : senderInboxId,
        audience: audiencePayload,
        // Funil pronto: o lead entra no funil; senão, a sequência montada.
        flow_automation_id: flowMode ? flowId : undefined,
        funnel_items: cloudMode || flowMode ? undefined : toSequencePayload(items),
        post_send:
          postStageId || postLabel.trim()
            ? { stage_id: postStageId || undefined, label: postLabel.trim() || undefined }
            : undefined,
        min_interval_seconds: minS,
        max_interval_seconds: maxS,
        batch_size: batchSize,
        batch_pause_seconds: pauseS,
        business_hours_only: businessHours,
        respect_opt_out: respectOptOut,
        frequency_cap_days: frequencyCapDays,
        max_spend: maxSpend.trim() ? Number(maxSpend.replace(',', '.')) : undefined,
      });
      setStep('done');
      toast.success('Disparo criado. As mensagens saem em lotes.');
    } catch (err: any) {
      const msg = err?.response?.data?.errors?.[0] || err?.message || 'Não consegui criar o disparo';
      toast.error(msg);
      setStep('review');
    } finally {
      setCreating(false);
    }
  };

  const stepIndex = ['audience', 'messages', 'cadence', 'review'].indexOf(step);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Disparo em massa {pipelineName ? `· ${pipelineName}` : ''}
          </DialogTitle>
          <DialogDescription>
            Escolha por onde sai e quem recebe, o que mandar e o ritmo, e dispare.
          </DialogDescription>
        </DialogHeader>

        {/* indicador de passos */}
        {step !== 'creating' && step !== 'done' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pb-1">
            {['Quem recebe', 'Mensagem', 'Ritmo', 'Revisar'].map((lbl, i) => (
              <span
                key={lbl}
                className={`flex items-center gap-1 ${i === stepIndex ? 'text-primary font-medium' : ''}`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    i <= stepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  {i + 1}
                </span>
                {lbl}
                {i < 3 && <span className="mx-1">·</span>}
              </span>
            ))}
          </div>
        )}

        {/* STEP 1 — Por onde sai e quem recebe */}
        {step === 'audience' && (
          <PassoQuemRecebe
            channelKind={channelKind}
            aoEscolherCanal={setChannelKind}
            temOficial={cloudOptions.length > 0}
            erroCanais={erroCanais}
            aoTentarCanais={carregarCanais}
            numeros={senderOptions}
            erroNumeros={erroNumeros}
            aoTentarNumeros={carregarNumeros}
            senderInboxId={senderInboxId}
            aoEscolherNumero={setSenderInboxId}
            audienceMode={audienceMode}
            aoEscolherPublico={setAudienceMode}
            stages={stages}
            stageId={stageId}
            aoEscolherEtapa={setStageId}
            etiquetas={availableLabels}
            erroEtiquetas={erroEtiquetas}
            aoTentarEtiquetas={carregarEtiquetas}
            etiquetasMarcadas={selectedLabels}
            aoMarcarEtiqueta={titulo =>
              setSelectedLabels(prev => (prev.includes(titulo) ? prev.filter(t => t !== titulo) : [...prev, titulo]))
            }
            previa={audiencePreview}
            contando={countingAudience || esperandoNumeros}
            erroPrevia={erroPrevia}
          />
        )}

        {/* STEP 2 — O que mandar */}
        {step === 'messages' && (
          <PassoMensagem
            cloudMode={cloudMode}
            sendMode={sendMode}
            aoEscolherModo={setSendMode}
            items={items}
            aoMudarItens={setItems}
            variables={variables}
            flowId={flowId}
            aoEscolherFunil={(id, nome) => {
              setFlowId(id);
              setFlowName(nome);
            }}
            cloudOptions={cloudOptions}
            erroCanais={erroCanais}
            aoTentarCanais={carregarCanais}
            cloudInbox={selectedCloudInbox}
            aoEscolherNumeroOficial={v => {
              setCloudInboxId(v);
              setCloudTemplateName('');
              setCloudVars({});
            }}
            cloudTemplateName={cloudTemplateName}
            cloudTemplate={selectedCloudTemplate}
            aoEscolherModelo={v => {
              setCloudTemplateName(v);
              setCloudVars({});
            }}
            cloudVars={cloudVars}
            aoMudarVariavel={(v, valor) => setCloudVars(prev => ({ ...prev, [v]: valor }))}
          />
        )}
        {/* STEP 3 — Cadência */}
        {step === 'cadence' && (
          <div className="grid gap-5">
            <GrupoDaJanela titulo="Intervalo entre mensagens">
              <GradeDaJanela>
                <CampoDaJanela rotulo="Intervalo mínimo (segundos)" htmlFor="disparo-min" colunas={2}>
                  <Input
                    id="disparo-min"
                    type="number"
                    min={2}
                    value={minS}
                    onChange={e => setMinS(Math.max(2, Number(e.target.value) || 2))}
                    className="h-9"
                  />
                </CampoDaJanela>
                <CampoDaJanela rotulo="Intervalo máximo (segundos)" htmlFor="disparo-max" colunas={2}>
                  <Input
                    id="disparo-max"
                    type="number"
                    min={2}
                    value={maxS}
                    onChange={e => setMaxS(Math.max(2, Number(e.target.value) || 2))}
                    className="h-9"
                  />
                </CampoDaJanela>
              </GradeDaJanela>
            </GrupoDaJanela>

            <GrupoDaJanela titulo="Lote">
              <GradeDaJanela>
                <CampoDaJanela rotulo="Mensagens por lote" htmlFor="disparo-lote" colunas={2}>
                  <Input
                    id="disparo-lote"
                    type="number"
                    min={1}
                    max={50}
                    value={batchSize}
                    onChange={e => setBatchSize(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                    className="h-9"
                  />
                </CampoDaJanela>
                <CampoDaJanela rotulo="Pausa entre lotes (segundos)" htmlFor="disparo-pausa" colunas={2}>
                  <Input
                    id="disparo-pausa"
                    type="number"
                    min={10}
                    value={pauseS}
                    onChange={e => setPauseS(Math.max(10, Number(e.target.value) || 10))}
                    className="h-9"
                  />
                </CampoDaJanela>
              </GradeDaJanela>
            </GrupoDaJanela>

            <GrupoDaJanela titulo="Limites">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={businessHours}
                  onChange={e => setBusinessHours(e.target.checked)}
                  className="rounded border-border"
                />
                Só enviar em horário comercial (seg-sex 08-20h, sáb 09-18h)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={respectOptOut}
                  onChange={e => setRespectOptOut(e.target.checked)}
                  className="rounded border-border"
                />
                Não enviar pra quem pediu pra parar
              </label>
              <GradeDaJanela>
                <CampoDaJanela rotulo="Não reenviar nos últimos (dias)" htmlFor="disparo-frequencia" colunas={channelKind === 'whatsapp_cloud' ? 2 : 4}>
                  <Input
                    id="disparo-frequencia"
                    type="number"
                    min={0}
                    value={frequencyCapDays}
                    onChange={e => setFrequencyCapDays(Math.max(0, Number(e.target.value) || 0))}
                    className="h-9"
                    placeholder="0 = sem limite"
                  />
                </CampoDaJanela>
                {channelKind === 'whatsapp_cloud' && (
                  <CampoDaJanela rotulo="Teto de gasto (R$)" htmlFor="disparo-teto" colunas={2}>
                    <Input
                      id="disparo-teto"
                      type="number"
                      min={0}
                      step="0.01"
                      value={maxSpend}
                      onChange={e => setMaxSpend(e.target.value)}
                      className="h-9"
                      placeholder="opcional"
                    />
                  </CampoDaJanela>
                )}
              </GradeDaJanela>
            </GrupoDaJanela>

            {costEstimate && (
              <p className="text-xs text-muted-foreground">
                Custo estimado: <strong className="text-foreground">
                  R$ {costEstimate.total.toFixed(2).replace('.', ',')}
                </strong>{' '}
                ({recipientCount} msg × R$ {costEstimate.rate.toFixed(2).replace('.', ',')}, categoria {costEstimate.cat}). Estimativa — custo real vem da Meta.
              </p>
            )}
            {!step3Ok && (
              <Aviso tom="atencao" compacto>
                O máximo deve ser maior ou igual ao mínimo (a partir de 2 segundos), o lote fica entre 1 e 50 e a pausa é de pelo menos 10 segundos.
              </Aviso>
            )}
            {recipientCount ? (
              <p className="text-xs text-muted-foreground">
                Duração estimada: ~{estDurationMin} min pra {plural(recipientCount, 'contato', 'contatos')}.
              </p>
            ) : null}
          </div>
        )}

        {/* STEP 4 — Revisão */}
        {step === 'review' && (
          <div className="grid gap-5">
            <GrupoDaJanela titulo="Envio">
              <CampoDaJanela rotulo="Nome do envio" htmlFor="disparo-nome" ajuda="Aparece no registro dos disparos.">
                <Input
                  id="disparo-nome"
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="Ex.: oferta de lançamento, base quente"
                  maxLength={120}
                  className="h-9"
                />
              </CampoDaJanela>
            </GrupoDaJanela>

            {/* Após o envio (opcional): mover pra etapa + criar/aplicar tag */}
            <GrupoDaJanela titulo="Após o envio (opcional)">
              <CampoDaJanela rotulo="Mover quem recebeu para a etapa" htmlFor="disparo-etapa-depois">
                <Select value={postStageId || 'none'} onValueChange={v => setPostStageId(v === 'none' ? '' : v)}>
                  <SelectTrigger id="disparo-etapa-depois" className="h-9 w-full">
                    <SelectValue placeholder="Não mover" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não mover</SelectItem>
                    {stages.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CampoDaJanela>
              <CampoDaJanela rotulo="Aplicar etiqueta" htmlFor="disparo-etiqueta-depois" ajuda="Cria a etiqueta se ela não existir.">
                <Input
                  id="disparo-etiqueta-depois"
                  value={postLabel}
                  onChange={e => setPostLabel(e.target.value)}
                  placeholder="Ex.: recebeu-oferta"
                  maxLength={60}
                  className="h-9"
                />
                {availableLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {availableLabels.slice(0, 12).map(l => (
                      <button
                        key={l.title}
                        type="button"
                        onClick={() => setPostLabel(l.title)}
                        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] hover:bg-muted"
                        style={{ borderColor: `${l.color || '#7c3aed'}66` }}
                      >
                        {l.title}
                      </button>
                    ))}
                  </div>
                )}
              </CampoDaJanela>
            </GrupoDaJanela>

            <CaixaDaJanela titulo="Resumo">
              <div className="divide-y divide-border text-sm">
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Destinatários</span>
                  <strong>{recipientCount}</strong>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Canal</span>
                  <strong>{cloudMode ? 'WhatsApp oficial (modelo)' : 'Campanha direta'}</strong>
                </div>
                {!cloudMode && selectedSender && (
                  <div className="flex justify-between gap-3 py-2">
                    <span className="text-muted-foreground">Número de saída</span>
                    <strong className="text-right">
                      {selectedSender.name}
                      {selectedSender.phone ? ` · ${telefone(selectedSender.phone)}` : ''}
                    </strong>
                  </div>
                )}
                <div className="flex justify-between gap-3 py-2">
                  <span className="text-muted-foreground">
                    {cloudMode ? 'Modelo' : flowMode ? 'Funil' : 'Itens na sequência'}
                  </span>
                  <strong className="text-right">
                    {cloudMode ? selectedCloudTemplate?.name : flowMode ? flowName : items.length}
                  </strong>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Ritmo</span>
                  <strong>
                    {minS}-{maxS}s · lotes de {batchSize} · pausa {pauseS}s
                  </strong>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Horário comercial</span>
                  <strong>{businessHours ? 'Sim' : 'Não'}</strong>
                </div>
              </div>
            </CaixaDaJanela>

            {!cloudMode && !flowMode && (
              <GrupoDaJanela titulo="Mensagens">
                {items.map((it, i) => (
                  <div key={it.uiKey} className="p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">
                    <span className="text-xs text-muted-foreground block mb-1">
                      #{i + 1} · {KIND_LABEL[it.kind]}
                      {it.delay_seconds > 0 && ` · aguarda ${it.delay_seconds}s`}
                      {it.kind === 'text' &&
                        (it.text_variations?.filter(v => v.trim()).length ?? 0) > 0 &&
                        ` · ${(it.text_variations?.filter(v => v.trim()).length ?? 0) + 1} variações (sorteia 1/lead)`}
                    </span>
                    {it.kind !== 'text' && (
                      <span className="text-xs text-primary flex items-center gap-1 mb-1">
                        <Paperclip className="w-3 h-3" /> mídia anexada
                      </span>
                    )}
                    {it.kind === 'text'
                      ? preview(it.text_content ?? '')
                      : it.media_caption
                        ? preview(it.media_caption)
                        : <span className="text-muted-foreground italic">(sem legenda)</span>}
                  </div>
                ))}
              </GrupoDaJanela>
            )}

            {cloudMode && selectedCloudTemplate && (
              <GrupoDaJanela titulo="Mensagem">
                <div className="p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <ShieldCheck className="w-3 h-3" /> Modelo {selectedCloudTemplate.name} · {selectedCloudTemplate.language}
                  </span>
                  {preview(
                    selectedCloudTemplate.variables.reduce(
                      (txt, v, i) => txt.replace(`{{${i + 1}}}`, cloudVars[v] || `{{${i + 1}}}`),
                      selectedCloudTemplate.content,
                    ),
                  )}
                </div>
              </GrupoDaJanela>
            )}

            {/* Enviar teste pra um número antes de disparar pros leads. No funil
                pronto fica escondido por enquanto (o passo Revisar é refeito na próxima tarefa). */}
            {!flowMode && (
              <GrupoDaJanela titulo="Teste (opcional)">
                <CampoDaJanela
                  rotulo="Enviar teste pra um número"
                  ajuda={cloudMode
                    ? 'Manda o modelo só pra esse número, sem tocar nos leads.'
                    : 'Manda a sequência inteira só pra esse número, sem tocar nos leads.'}
                >
                  <div className="flex items-center gap-2">
                    <PhoneInput
                      value={testPhone}
                      onChange={setTestPhone}
                      placeholder="(11) 99999-9999"
                      valueFormat="digits"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTest}
                      disabled={testing}
                      className="whitespace-nowrap"
                    >
                      {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar teste'}
                    </Button>
                  </div>
                </CampoDaJanela>
              </GrupoDaJanela>
            )}
          </div>
        )}

        {/* STEP creating / done */}
        {step === 'creating' && (
          <div className="space-y-3 py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <div className="text-sm">Criando o disparo...</div>
          </div>
        )}
        {step === 'done' && (
          <div className="space-y-3 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
            <div className="text-lg font-semibold">Disparo no ar</div>
            <div className="text-sm text-muted-foreground">
              As mensagens saem em lotes respeitando o ritmo escolhido. Acompanhe na página Disparos.
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'audience' && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setStep('messages')} disabled={!step1Ok}>
                Próximo
              </Button>
            </>
          )}
          {step === 'messages' && (
            <>
              <Button variant="outline" onClick={() => setStep('audience')}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => setStep('cadence')} disabled={!step2Ok}>
                Próximo
              </Button>
            </>
          )}
          {step === 'cadence' && (
            <>
              <Button variant="outline" onClick={() => setStep('messages')}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => setStep('review')} disabled={!step3Ok}>
                Próximo
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={() => setStep('cadence')}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button onClick={handleCreate} disabled={creating || !step1Ok || !step2Ok}>
                <Megaphone className="w-4 h-4 mr-1" /> Disparar pra {recipientCount}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={() => handleClose(false)}>Ver disparos</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
