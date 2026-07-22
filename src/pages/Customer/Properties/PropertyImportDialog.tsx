import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { toast } from 'sonner';
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '@/components/ui/ds';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  ImagePlus,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  propertyImportsService,
  PropertyImportBatch,
  PropertyImportItem,
  IMPORT_ACCEPTED_MIME_TYPES,
  IMPORT_MAX_FILES,
  IMPORT_MAX_FILE_BYTES,
  MISSING_FIELD_LABELS,
} from '@/services/propertyImports/propertyImportsService';
import { propertiesService } from '@/services/properties/propertiesService';
import { propertyPhotosService, ACCEPTED_MIME_TYPES as PHOTO_MIME_TYPES } from '@/services/propertyPhotos/propertyPhotosService';

// Chave pra retomar o acompanhamento se o corretor fechar o modal/página no
// meio do lote (o processamento continua no backend).
const ACTIVE_BATCH_KEY = 'lmflow.property_import.batch_id';

const POLL_MS = 4000;

const TERMINAL_STATUSES = ['completed', 'completed_with_errors', 'failed', 'canceled'];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Abre o modal de edição existente pro corretor revisar o imóvel criado. */
  onReview: (propertyId: string) => void;
  /** Recarrega a listagem quando o lote cria/ativa imóveis. */
  onChanged: () => void;
  /** Incrementado pela tela quando um imóvel é salvo na revisão — re-busca o lote
   *  pra atualizar chips de campos faltantes, preço e thumbnail. */
  refreshSignal?: number;
}

export default function PropertyImportDialog({ open, onClose, onReview, onChanged, refreshSignal }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [urlsText, setUrlsText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [batch, setBatch] = useState<PropertyImportBatch | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [uploadingPhotosFor, setUploadingPhotosFor] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const photoTargetRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const poll = useCallback(async (batchId: string) => {
    try {
      const b = await propertyImportsService.get(batchId);
      setBatch(b);
      if (TERMINAL_STATUSES.includes(b.status)) {
        stopPolling();
        sessionStorage.removeItem(ACTIVE_BATCH_KEY);
        onChanged();
        if (b.status === 'completed') toast.success(`Lote concluído: ${b.success_items} imóvel(is) criado(s) como rascunho`);
        else if (b.status === 'completed_with_errors') toast.warning(`Lote concluído: ${b.success_items} criado(s), ${b.error_items} com erro`);
        else if (b.status === 'failed') toast.error('Nenhum item do lote pôde ser processado');
      }
    } catch {
      // erro transitório de rede — o próximo tick tenta de novo
    }
  }, [onChanged, stopPolling]);

  const startPolling = useCallback((batchId: string) => {
    stopPolling();
    sessionStorage.setItem(ACTIVE_BATCH_KEY, batchId);
    poll(batchId);
    pollRef.current = setInterval(() => poll(batchId), POLL_MS);
  }, [poll, stopPolling]);

  // Retoma um lote em andamento ao reabrir o modal.
  useEffect(() => {
    if (!open) { stopPolling(); return; }
    const saved = sessionStorage.getItem(ACTIVE_BATCH_KEY);
    if (saved && !batch) startPolling(saved);
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Revisou/salvou um imóvel na tela? Re-busca o lote pra atualizar chips/preço/capa.
  useEffect(() => {
    if (!open || !refreshSignal) return;
    const id = batch?.id ?? sessionStorage.getItem(ACTIVE_BATCH_KEY);
    if (id) poll(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const openPhotoPicker = (propertyId: string) => {
    photoTargetRef.current = propertyId;
    photoInputRef.current?.click();
  };

  const handlePhotoFiles = async (fileList: FileList | null) => {
    const propertyId = photoTargetRef.current;
    const photos = Array.from(fileList ?? []);
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (!propertyId || !photos.length) return;

    setUploadingPhotosFor(propertyId);
    try {
      await propertyPhotosService.upload(propertyId, photos);
      toast.success(`${photos.length} foto${photos.length > 1 ? 's' : ''} enviada${photos.length > 1 ? 's' : ''}`);
      const id = batch?.id ?? sessionStorage.getItem(ACTIVE_BATCH_KEY);
      if (id) await poll(id);
      onChanged();
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err?.response?.data?.error?.message || 'Falha no upload das fotos');
    } finally {
      setUploadingPhotosFor(null);
    }
  };

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    if (rejected.length) {
      toast.error(`${rejected.length} arquivo(s) recusado(s) — use PDF, imagem, Word ou TXT de até 20MB`);
    }
    setFiles(prev => {
      const merged = [...prev, ...accepted].slice(0, IMPORT_MAX_FILES);
      if (prev.length + accepted.length > IMPORT_MAX_FILES) {
        toast.warning(`Máximo de ${IMPORT_MAX_FILES} arquivos por lote`);
      }
      return merged;
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: Object.fromEntries(IMPORT_ACCEPTED_MIME_TYPES.map(t => [t, []])),
    maxSize: IMPORT_MAX_FILE_BYTES,
    disabled: uploading || !!batch,
  });

  const parseUrls = () =>
    urlsText.split('\n').map(u => u.trim()).filter(u => /^https?:\/\//i.test(u));

  const handleStart = async () => {
    const urls = parseUrls();
    if (!files.length && !urls.length) {
      toast.error('Adicione arquivos (books) ou cole links de anúncios');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const b = await propertyImportsService.createBatch(files, {
        urls,
        onProgress: setUploadProgress,
      });
      setBatch(b);
      setFiles([]);
      setUrlsText('');
      startPolling(b.id);
      toast.info('Lote enviado — a IA está lendo os materiais e criando os rascunhos');
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string }; message?: string } } };
      toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || 'Erro ao enviar o lote');
    } finally {
      setUploading(false);
    }
  };

  const missingPrice = (item: PropertyImportItem) =>
    item.property?.has_price != null
      ? !item.property.has_price
      : item.missing_fields.includes('sale_price') || item.missing_fields.includes('rent_price');

  const handleActivate = async (item: PropertyImportItem) => {
    if (!item.property) return;
    if (missingPrice(item)) {
      toast.error('Sem preço — revise o imóvel e informe o valor antes de ativar');
      return;
    }
    setActivating(item.property.id);
    try {
      await propertiesService.update(item.property.id, { status: 'active' });
      toast.success(`${item.property.code} ativado`);
      if (batch) poll(batch.id);
      onChanged();
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err?.response?.data?.error?.message || 'Não consegui ativar — revise o imóvel');
    } finally {
      setActivating(null);
    }
  };

  const handleActivateAll = async () => {
    const candidates = (batch?.items ?? []).filter(
      i => i.status === 'created' && i.property?.status === 'draft' && !missingPrice(i),
    );
    if (!candidates.length) { toast.info('Nenhum rascunho pronto pra ativar (verifique preços faltantes)'); return; }
    setActivating('all');
    let ok = 0;
    for (const item of candidates) {
      try {
        await propertiesService.update(item.property!.id, { status: 'active' });
        ok += 1;
      } catch { /* segue os demais */ }
    }
    toast.success(`${ok} imóvel(is) ativado(s)`);
    if (batch) await poll(batch.id);
    onChanged();
    setActivating(null);
  };

  const handleRetry = async () => {
    if (!batch) return;
    setRetrying(true);
    try {
      const b = await propertyImportsService.retryFailed(batch.id);
      setBatch(b);
      startPolling(b.id);
    } catch {
      toast.error('Não consegui reprocessar os erros');
    } finally {
      setRetrying(false);
    }
  };

  const handleNewBatch = () => {
    stopPolling();
    sessionStorage.removeItem(ACTIVE_BATCH_KEY);
    setBatch(null);
  };

  const running = !!batch && !TERMINAL_STATUSES.includes(batch.status);

  const itemStatusBadge = (item: PropertyImportItem) => {
    switch (item.status) {
      case 'created':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Criado</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Erro</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Lendo…</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">Na fila</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className={batch
          ? 'max-w-6xl w-[95vw] h-[92vh] flex flex-col overflow-hidden'
          : 'max-w-3xl max-h-[90vh] overflow-y-auto'}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar imóveis em lote (IA)
          </DialogTitle>
          <DialogDescription>
            Suba até {IMPORT_MAX_FILES} books (PDF, foto, Word ou TXT — 1 arquivo = 1 imóvel) ou cole links de
            anúncios. A IA lê cada material e cria o imóvel como <strong>rascunho</strong> pra você revisar e ativar.
          </DialogDescription>
        </DialogHeader>

        {!batch && (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">
                {isDragActive ? 'Solte os arquivos aqui' : 'Arraste os books aqui ou clique pra escolher'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, JPG/PNG/WebP, DOCX ou TXT · máx {IMPORT_MAX_FILE_BYTES / 1024 / 1024}MB por arquivo
              </p>
            </div>

            {files.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {files.map((f, idx) => (
                  <div key={`${f.name}-${idx}`} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                    <button
                      type="button"
                      onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">{files.length} arquivo(s) — 1 imóvel por arquivo</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-1">Links de anúncios (opcional — um por linha)</p>
              <Textarea
                value={urlsText}
                onChange={e => setUrlsText(e.target.value)}
                placeholder={'https://www.olx.com.br/...\nhttps://www.zapimoveis.com.br/...'}
                rows={3}
                disabled={uploading}
              />
            </div>

            {uploading && (
              <div className="space-y-1">
                <div className="h-2 bg-muted rounded overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground text-center">Enviando arquivos… {uploadProgress}%</p>
              </div>
            )}
          </div>
        )}

        {batch && (
          <div className="space-y-3 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between rounded-lg border p-3 shrink-0">
              <div className="flex items-center gap-2 text-sm">
                {running
                  ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  : batch.error_items > 0
                    ? <AlertCircle className="h-4 w-4 text-orange-500" />
                    : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                <span className="font-medium">
                  {running ? 'Processando' : 'Concluído'} — {batch.processed_items}/{batch.total_items}
                </span>
                <span className="text-muted-foreground">
                  ({batch.success_items} criado{batch.success_items !== 1 ? 's' : ''}
                  {batch.error_items > 0 ? `, ${batch.error_items} erro${batch.error_items !== 1 ? 's' : ''}` : ''})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-32 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${batch.total_items ? Math.round((batch.processed_items * 100) / batch.total_items) : 0}%` }}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Atualizar"
                  onClick={() => poll(batch.id)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {(batch.items ?? []).map(item => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex gap-3">
                    {/* Thumbnail: capa do imóvel ou atalho pra subir fotos ali mesmo */}
                    {item.status === 'created' && item.property && (
                      <button
                        type="button"
                        title={item.property.cover_photo_url ? 'Adicionar mais fotos' : 'Subir fotos deste imóvel'}
                        onClick={() => openPhotoPicker(item.property!.id)}
                        disabled={uploadingPhotosFor !== null}
                        className="relative h-16 w-16 shrink-0 rounded-md border overflow-hidden bg-muted/50 hover:border-primary transition-colors flex items-center justify-center"
                      >
                        {uploadingPhotosFor === item.property.id ? (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        ) : item.property.cover_photo_url ? (
                          <>
                            <img src={item.property.cover_photo_url} alt="" className="h-full w-full object-cover" />
                            {(item.property.photos_count ?? 0) > 0 && (
                              <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[10px] px-1 rounded-tl">
                                {item.property.photos_count}
                              </span>
                            )}
                          </>
                        ) : (
                          <ImagePlus className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                    )}

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium truncate flex-1">
                          {item.file_name || item.source_url}
                        </span>
                        {itemStatusBadge(item)}
                      </div>

                      {item.status === 'created' && (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {item.property?.code} — {item.extracted_summary.title || item.property?.title}
                            {item.property?.display_price ? ` · ${item.property.display_price}` : ''}
                            {item.extracted_summary.address_city ? ` · ${item.extracted_summary.address_city}` : ''}
                          </p>
                          {item.missing_fields.length > 0 ? (
                            <div className="flex flex-wrap gap-1 items-center">
                              <span className="text-xs text-orange-600 dark:text-orange-400">Faltou:</span>
                              {item.missing_fields.map(f => (
                                <Badge key={f} variant="outline" className="text-xs text-orange-600 border-orange-300">
                                  {MISSING_FIELD_LABELS[f] ?? f}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Dados completos
                            </p>
                          )}
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" variant="outline" onClick={() => item.property && onReview(item.property.id)}>
                              Revisar
                            </Button>
                            {item.property?.status === 'draft' && (
                              <Button
                                size="sm"
                                disabled={activating !== null}
                                onClick={() => handleActivate(item)}
                              >
                                {activating === item.property?.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Ativar'}
                              </Button>
                            )}
                          </div>
                        </>
                      )}

                      {item.status === 'error' && (
                        <p className="text-xs text-red-600 dark:text-red-400">{item.error_message}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input escondido do upload de fotos por item */}
        <input
          ref={photoInputRef}
          type="file"
          multiple
          accept={PHOTO_MIME_TYPES.join(',')}
          className="hidden"
          onChange={e => handlePhotoFiles(e.target.files)}
        />

        <DialogFooter className="gap-2">
          {!batch && (
            <>
              <Button variant="outline" onClick={onClose} disabled={uploading}>Cancelar</Button>
              <Button onClick={handleStart} disabled={uploading || (!files.length && !parseUrls().length)}>
                {uploading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando…</>
                  : <><Sparkles className="h-4 w-4 mr-2" />Importar com IA</>}
              </Button>
            </>
          )}
          {batch && (
            <>
              {!running && batch.error_items > 0 && (
                <Button variant="outline" onClick={handleRetry} disabled={retrying}>
                  {retrying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Reprocessar erros
                </Button>
              )}
              {!running && (
                <Button variant="outline" onClick={handleNewBatch}>Novo lote</Button>
              )}
              {batch.success_items > 0 && (
                <Button onClick={handleActivateAll} disabled={activating !== null}>
                  {activating === 'all' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Ativar todos
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                {running ? 'Continuar em segundo plano' : 'Fechar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
