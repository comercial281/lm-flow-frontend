import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Label,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@evoapi/design-system';
import { Upload, FileText, Trash2, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { PipelineStage } from '@/types/analytics';
import { ContactFormData } from '@/types/contacts';
import { pipelinesService } from '@/services/pipelines';
import { contactsService } from '@/services/contacts';
import { labelsService } from '@/services/contacts/labelsService';
import { customAttributesService } from '@/services/customAttributes/customAttributesService';

interface ImportLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Quando pipelineId/stages são passados: importa pro pipeline (kanban).
  // Quando omitidos: importa só pro CRM de Contatos (sem etapa/pipeline).
  pipelineId?: string;
  pipelineName?: string;
  stages?: PipelineStage[];
  onImported: () => void;
}

// Campos fixos de destino do CRM
const FIXED_TARGETS: { value: string; label: string }[] = [
  { value: 'ignore', label: 'Não importar' },
  { value: 'name', label: 'Nome' },
  { value: 'phone_number', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'value', label: 'Valor (R$)' },
  { value: 'notes', label: 'Observações' },
];

const NONE_TAG = '__none__';
const CREATE_TAG = '__create__';

type Step = 'upload' | 'map' | 'importing' | 'done';

// Parser CSV simples com suporte a aspas e delimitador , ou ;
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = clean.split('\n')[0] || '';
  const delimiter = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ';' : ',';

  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      record.push(field);
      field = '';
    } else if (c === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter(r => r.some(cell => cell.trim() !== ''));
  const headers = (nonEmpty.shift() || []).map(h => h.trim());
  return { headers, rows: nonEmpty };
}

// Normaliza telefone para E.164 (backend exige). Limpa tudo que não é dígito
// e prefixa "+". Mantém "+" já existente. Vazio retorna vazio.
function normalizePhoneE164(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const hadPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return hadPlus ? `+${digits}` : `+${digits}`;
}

// Adivinha o campo de destino pelo nome da coluna
function guessTarget(header: string, customKeys: string[]): string {
  const h = header.toLowerCase().trim();
  if (/(nome|name|cliente|lead)/.test(h)) return 'name';
  if (/(telefone|celular|phone|whats|fone|contato)/.test(h)) return 'phone_number';
  if (/(email|e-mail|mail)/.test(h)) return 'email';
  if (/(valor|value|pre[çc]o|or[çc]amento)/.test(h)) return 'value';
  if (/(obs|observa|nota|coment|mensagem)/.test(h)) return 'notes';
  const ck = customKeys.find(k => k.toLowerCase() === h);
  if (ck) return `custom:${ck}`;
  return 'ignore';
}

export default function ImportLeadsModal({
  open,
  onOpenChange,
  pipelineId,
  pipelineName,
  stages,
  onImported,
}: ImportLeadsModalProps) {
  const isPipelineMode = !!pipelineId;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [stageId, setStageId] = useState('');
  const [tag, setTag] = useState(NONE_TAG);
  const [labels, setLabels] = useState<{ id: string; title: string }[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);
  const [customAttrs, setCustomAttrs] = useState<{ attribute_key: string; attribute_display_name: string }[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0 });
  const [errors, setErrors] = useState<string[]>([]);

  // Carrega tags, campos personalizados e stage default ao abrir
  useEffect(() => {
    if (!open) return;
    setStageId(stages?.[0]?.id || '');
    labelsService
      .getLabels()
      .then(res => setLabels(((res.data as any[]) || []).map(l => ({ id: l.id, title: l.title }))))
      .catch(() => setLabels([]));
    customAttributesService
      .getCustomAttributes('contact_attribute')
      .then(res =>
        setCustomAttrs(
          ((res.data as any[]) || []).map(a => ({
            attribute_key: a.attribute_key,
            attribute_display_name: a.attribute_display_name,
          })),
        ),
      )
      .catch(() => setCustomAttrs([]));
  }, [open, stages]);

  const customKeys = useMemo(() => customAttrs.map(a => a.attribute_key), [customAttrs]);

  const targetOptions = useMemo(
    () => [
      ...FIXED_TARGETS,
      ...customAttrs.map(a => ({ value: `custom:${a.attribute_key}`, label: a.attribute_display_name })),
    ],
    [customAttrs],
  );

  const resetAll = () => {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setTag(NONE_TAG);
    setNewTagName('');
    setProgress({ done: 0, total: 0, ok: 0, fail: 0 });
    setErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Cria uma etiqueta nova na hora e já a seleciona.
  const handleCreateTag = async () => {
    const title = newTagName.trim();
    if (!title) return;
    setCreatingTag(true);
    try {
      await labelsService.createLabel({ title, color: '#7C3AED', show_on_sidebar: true });
      const res = await labelsService.getLabels();
      setLabels(((res.data as any[]) || []).map(l => ({ id: l.id, title: l.title })));
      setTag(title);
      setNewTagName('');
      toast.success(`Etiqueta "${title}" criada.`);
    } catch {
      toast.error('Não consegui criar a etiqueta.');
    } finally {
      setCreatingTag(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (step === 'importing') return; // não fecha durante import
    if (!v) resetAll();
    onOpenChange(v);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 5MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const { headers: h, rows: r } = parseCSV(String(reader.result || ''));
      if (h.length === 0 || r.length === 0) {
        toast.error('Arquivo vazio ou sem cabeçalho.');
        return;
      }
      setFileName(file.name);
      setHeaders(h);
      setRows(r);
      const initial: Record<number, string> = {};
      h.forEach((col, i) => {
        initial[i] = guessTarget(col, customKeys);
      });
      setMapping(initial);
      setStep('map');
    };
    reader.readAsText(file, 'utf-8');
  };

  const nameMapped = Object.values(mapping).includes('name');

  const handleImport = async () => {
    if (!nameMapped) {
      toast.error('Mapeie ao menos uma coluna para "Nome".');
      return;
    }
    if (isPipelineMode && !stageId) {
      toast.error('Escolha a coluna (etapa) do pipeline.');
      return;
    }
    setStep('importing');
    const total = rows.length;
    setProgress({ done: 0, total, ok: 0, fail: 0 });
    const collectedErrors: string[] = [];
    const importedContactIds: string[] = [];
    let ok = 0;
    let fail = 0;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const data: Record<string, any> = { type: 'person', custom_attributes: {} };
      let value: string | undefined;
      let notes: string | undefined;

      headers.forEach((_, i) => {
        const target = mapping[i];
        const cell = (row[i] ?? '').trim();
        if (!target || target === 'ignore' || cell === '') return;
        if (target === 'value') value = cell;
        else if (target === 'notes') notes = cell;
        else if (target === 'phone_number') {
          const phone = normalizePhoneE164(cell);
          if (phone) data.phone_number = phone;
        } else if (target.startsWith('custom:')) data.custom_attributes[target.slice(7)] = cell;
        else data[target] = cell;
      });

      if (!data.name) {
        fail++;
        collectedErrors.push(`Linha ${r + 2}: sem nome, pulada.`);
        setProgress({ done: r + 1, total, ok, fail });
        continue;
      }
      if (tag !== NONE_TAG && tag !== CREATE_TAG) data.labels = [tag];
      if (Object.keys(data.custom_attributes).length === 0) delete data.custom_attributes;

      try {
        const created: any = await contactsService.createContact(data as ContactFormData);
        const contactId = created?.id || created?.contact?.id;
        if (!contactId) throw new Error('contato criado sem id');
        const customFields: Record<string, unknown> = {};
        if (value) {
          const num = parseFloat(value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
          if (!isNaN(num)) customFields.value = num;
        }
        if (notes) customFields.notes = notes;
        const hasCustom = Object.keys(customFields).length > 0;
        if (isPipelineMode && pipelineId) {
        try {
          await pipelinesService.addItemToPipeline(pipelineId, {
            item_id: contactId,
            type: 'contact',
            pipeline_stage_id: stageId,
            notes: notes || undefined,
            custom_fields: hasCustom ? customFields : undefined,
          });
        } catch (addErr: any) {
          // O contato pode já ter entrado no pipeline automaticamente (auto-enroll
          // do pipeline padrão). Nesse caso, mover pra etapa escolhida em vez de falhar.
          const addMsg =
            addErr?.response?.data?.error?.message || addErr?.response?.data?.message || '';
          if (/already in this pipeline/i.test(addMsg)) {
            const pls = await contactsService.getContactPipelines(contactId);
            const match = (pls || []).find((p: any) => p.pipeline?.id === pipelineId);
            const itemId = match?.item?.id;
            if (itemId) {
              if (match.stage?.id !== stageId) {
                await pipelinesService.moveItem({
                  item_id: itemId,
                  pipeline_id: pipelineId,
                  from_stage_id: match.stage?.id,
                  to_stage_id: stageId,
                });
              }
              if (notes || hasCustom) {
                await pipelinesService.updateItemInPipeline(pipelineId, itemId, {
                  notes: notes || undefined,
                  custom_fields: hasCustom ? customFields : undefined,
                });
              }
            }
          } else {
            throw addErr;
          }
        }
        }

        importedContactIds.push(contactId);
        ok++;
      } catch (err: any) {
        fail++;
        const msg =
          err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'erro';
        collectedErrors.push(`Linha ${r + 2} (${data.name}): ${msg}`);
      }
      setProgress({ done: r + 1, total, ok, fail });
    }

    // Passe final anti-duplicação. O auto-enroll no pipeline padrão é assíncrono
    // (job em background), então pode entrar DEPOIS do create. Aqui esperamos e
    // removemos cada lead importado de qualquer pipeline que não seja o alvo.
    // Duas passadas com espera pra pegar enroll atrasado.
    if (isPipelineMode && importedContactIds.length > 0) {
      for (let pass = 0; pass < 2; pass++) {
        await new Promise(res => setTimeout(res, pass === 0 ? 2500 : 2500));
        for (const cid of importedContactIds) {
          try {
            const pls = await contactsService.getContactPipelines(cid);
            const others = (pls || []).filter(
              (p: any) => p.pipeline?.id && p.pipeline.id !== pipelineId && p.item?.id,
            );
            for (const o of others) {
              await pipelinesService.removeItemFromPipeline(o.pipeline.id, o.item.id);
            }
          } catch {
            /* best-effort: não atrapalha o resultado do import */
          }
        }
      }
    }

    setErrors(collectedErrors);
    setStep('done');
    if (ok > 0) {
      toast.success(`${ok} lead(s) importado(s).`);
      onImported();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isPipelineMode
              ? `Importar leads ${pipelineName ? `· ${pipelineName}` : ''}`
              : 'Importar contatos'}
          </DialogTitle>
          <DialogDescription>
            {isPipelineMode
              ? 'Suba uma planilha CSV, diga para onde vai cada coluna, escolha a etapa e a etiqueta, e confirme.'
              : 'Suba uma planilha CSV, diga para onde vai cada coluna, escolha a etiqueta, e confirme.'}
          </DialogDescription>
        </DialogHeader>

        {/* STEP UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full justify-start h-11"
            >
              <Upload className="mr-2 h-4 w-4" />
              Escolher arquivo CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">
              A primeira linha do arquivo deve ser o cabeçalho (nomes das colunas). Aceita separador vírgula ou ponto e vírgula.
            </p>
            <a
              href="/downloads/import-leads-sample.csv"
              download="modelo-leads.csv"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar planilha modelo
            </a>
          </div>
        )}

        {/* STEP MAP */}
        {step === 'map' && (
          <div className="space-y-5 py-2">
            <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm truncate">{fileName}</span>
              <span className="text-xs text-muted-foreground">{rows.length} linha(s)</span>
              <Button variant="ghost" size="sm" onClick={resetAll}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Mapeamento de colunas */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Para onde vai cada coluna da planilha</Label>
              <div className="space-y-2">
                {headers.map((col, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{col || `Coluna ${i + 1}`}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {rows[0]?.[i] ? `ex: ${rows[0][i]}` : ''}
                      </div>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <Select value={mapping[i] || 'ignore'} onValueChange={v => setMapping(m => ({ ...m, [i]: v }))}>
                      <SelectTrigger className="w-48 flex-shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {targetOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {!nameMapped && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Mapeie ao menos uma coluna para Nome.
                </p>
              )}
            </div>

            {/* Destino: etapa (só no modo pipeline) + etiqueta */}
            <div
              className={`grid grid-cols-1 gap-4 pt-2 border-t border-border ${
                isPipelineMode ? 'sm:grid-cols-2' : ''
              }`}
            >
              {isPipelineMode && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Etapa (coluna do pipeline)</Label>
                  <Select value={stageId} onValueChange={setStageId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolher etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {(stages || []).map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-sm">
                  {isPipelineMode ? 'Etiqueta (tag) nos leads' : 'Etiqueta (tag) nos contatos'}
                </Label>
                <Select
                  value={tag === CREATE_TAG ? CREATE_TAG : tag}
                  onValueChange={v => {
                    if (v === CREATE_TAG) {
                      setTag(CREATE_TAG);
                    } else {
                      setTag(v);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem etiqueta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_TAG}>Sem etiqueta</SelectItem>
                    {labels.map(l => (
                      <SelectItem key={l.id} value={l.title}>
                        {l.title}
                      </SelectItem>
                    ))}
                    <SelectItem value={CREATE_TAG}>+ Criar nova etiqueta</SelectItem>
                  </SelectContent>
                </Select>

                {tag === CREATE_TAG && (
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      value={newTagName}
                      onChange={e => setNewTagName(e.target.value)}
                      placeholder="Nome da etiqueta"
                      className="h-9"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateTag();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim() || creatingTag}
                      className="whitespace-nowrap"
                    >
                      {creatingTag ? 'Criando...' : 'Criar'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP IMPORTING */}
        {step === 'importing' && (
          <div className="space-y-4 py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <div className="text-sm">
              Importando {progress.done} de {progress.total}...
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* STEP DONE */}
        {step === 'done' && (
          <div className="space-y-4 py-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <div className="text-lg font-semibold">Importação concluída</div>
              <div className="text-sm text-muted-foreground">
                {progress.ok} importado(s){progress.fail > 0 ? `, ${progress.fail} com erro` : ''}.
              </div>
            </div>
            {errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto bg-muted/50 rounded-lg p-3 space-y-1">
                {errors.slice(0, 50).map((e, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    {e}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'map' && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={!nameMapped || !stageId}>
                Importar {rows.length} lead(s)
              </Button>
            </>
          )}
          {step === 'upload' && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
          )}
          {step === 'done' && <Button onClick={() => handleClose(false)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
