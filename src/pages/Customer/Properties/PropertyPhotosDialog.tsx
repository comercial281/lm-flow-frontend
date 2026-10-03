// Gerenciador de fotos e vídeos de um imóvel (subir, por URL, capa, ocultar,
// remover). Mora aqui para a lista de Imóveis (ação "Fotos e vídeos") e o
// cadastro (seção Fotos e vídeos, na edição) abrirem o mesmo.
import { useState, useEffect, useCallback, useRef, DragEvent } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label as UILabel,
} from '@/components/ui/ds';
import { Plus, Loader2, Image, X, Crown, Eye, EyeOff, Upload, Link as LinkIcon, Film } from 'lucide-react';
import type { Property } from '@/services/properties/propertiesService';
import {
  propertyPhotosService,
  PropertyPhoto,
  PHOTO_TYPE_LABELS,
  ACCEPTED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
} from '@/services/propertyPhotos/propertyPhotosService';
import { Seletor } from '@/components/base/Seletor';

export default function PropertyPhotosDialog({
  property,
  onClose,
}: {
  property: Property;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState('main');
  const [newCaption, setNewCaption] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      setPhotos(await propertyPhotosService.list(property.id));
    } catch {
      toast.error('Erro ao carregar fotos');
    } finally {
      setLoading(false);
    }
  }, [property.id]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  const validateFiles = (files: File[]): { ok: File[]; rejected: string[] } => {
    const ok: File[] = [];
    const rejected: string[] = [];
    files.forEach(f => {
      if (!ACCEPTED_MIME_TYPES.includes(f.type)) {
        rejected.push(`${f.name}: tipo não suportado (${f.type || 'desconhecido'})`);
        return;
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        rejected.push(`${f.name}: maior que ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB`);
        return;
      }
      ok.push(f);
    });
    return { ok, rejected };
  };

  const handleUpload = async (rawFiles: File[]) => {
    const { ok, rejected } = validateFiles(rawFiles);
    rejected.forEach(msg => toast.error(msg));
    if (!ok.length) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      const created = await propertyPhotosService.upload(property.id, ok, {
        photoType: newType,
        published: true,
        onProgress: setUploadProgress,
      });
      setPhotos(prev => [...prev, ...created]);
      toast.success(`${created.length} foto${created.length !== 1 ? 's' : ''} enviada${created.length !== 1 ? 's' : ''}`);
    } catch {
      toast.error('Erro ao enviar fotos');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) void handleUpload(files);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) void handleUpload(files);
  };

  const handleAddByUrl = async () => {
    if (!newUrl.trim()) { toast.error('URL da foto é obrigatória'); return; }
    setAddingUrl(true);
    try {
      const photo = await propertyPhotosService.create(property.id, {
        file_url: newUrl.trim(),
        photo_type: newType,
        caption: newCaption.trim() || undefined,
        published: true,
      });
      setPhotos(prev => [...prev, photo]);
      setNewUrl('');
      setNewCaption('');
      toast.success('Foto adicionada por URL');
    } catch {
      toast.error('Erro ao adicionar foto');
    } finally {
      setAddingUrl(false);
    }
  };

  const handleSetCover = async (photo: PropertyPhoto) => {
    try {
      await propertyPhotosService.setAsCover(property.id, photo.id);
      setPhotos(prev => prev.map(p => ({ ...p, is_cover: p.id === photo.id })));
      toast.success('Capa atualizada');
    } catch {
      toast.error('Erro ao definir capa');
    }
  };

  const handleTogglePublished = async (photo: PropertyPhoto) => {
    try {
      const updated = await propertyPhotosService.update(property.id, photo.id, { published: !photo.published });
      setPhotos(prev => prev.map(p => p.id === updated.id ? updated : p));
    } catch {
      toast.error('Erro ao atualizar visibilidade');
    }
  };

  const handleDelete = async (photo: PropertyPhoto) => {
    try {
      await propertyPhotosService.delete(property.id, photo.id);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      toast.success('Foto removida');
    } catch {
      toast.error('Erro ao remover foto');
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            Fotos — {property.title}
          </DialogTitle>
          <DialogDescription>
            {photos.length} foto{photos.length !== 1 ? 's' : ''} cadastrada{photos.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Dropzone — upload nativo de fotos e vídeos */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors text-center ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
          } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_MIME_TYPES.join(',')}
            onChange={handleFileInputChange}
            className="hidden"
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-medium">Enviando {uploadProgress}%...</p>
              <div className="w-full max-w-xs bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="bg-primary h-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-2 text-primary">
                <Upload className="h-7 w-7" />
                <Film className="h-7 w-7 opacity-60" />
              </div>
              <p className="text-sm font-medium">Arraste fotos ou vídeos aqui, ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground">
                Aceita JPG, PNG, WebP, HEIC, MP4, MOV, WebM · máx {MAX_UPLOAD_BYTES / (1024 * 1024)}MB por arquivo
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <UILabel className="text-xs text-muted-foreground shrink-0">Categorizar como:</UILabel>
          <Seletor
            value={newType}
            onChange={e => setNewType(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-48"
            disabled={uploading}
          >
            {Object.entries(PHOTO_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Seletor>
          <button
            type="button"
            onClick={() => setShowUrlInput(s => !s)}
            className="ml-auto text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            <LinkIcon className="h-3 w-3" />
            {showUrlInput ? 'Ocultar URL externa' : 'Adicionar por URL externa'}
          </button>
        </div>

        {showUrlInput && (
          <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <Input
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder="https://... (URL pública da imagem/vídeo já hospedado)"
                className="flex-1 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Input
                value={newCaption}
                onChange={e => setNewCaption(e.target.value)}
                placeholder="Legenda (opcional)"
                className="flex-1 text-sm"
              />
              <Button onClick={handleAddByUrl} disabled={addingUrl} size="sm">
                {addingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Adicionar
              </Button>
            </div>
          </div>
        )}

        {/* Photo list */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Carregando fotos...
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Image className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma foto cadastrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map(photo => {
              const isVideo = photo.content_type?.startsWith('video/') || photo.photo_type === 'video';
              return (
              <div key={photo.id} className="group relative rounded-lg overflow-hidden border border-border bg-muted aspect-video">
                {isVideo ? (
                  <video
                    src={photo.file_url}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    controls
                  />
                ) : (
                  <img
                    src={photo.thumbnail_url || photo.file_url}
                    alt={photo.alt_text ?? photo.caption ?? ''}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}

                {/* Badges */}
                <div className="absolute top-1.5 left-1.5 flex gap-1">
                  {photo.is_cover && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500 text-white font-medium flex items-center gap-0.5">
                      <Crown className="h-2.5 w-2.5" />
                      Capa
                    </span>
                  )}
                  {!photo.published && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-600 text-white font-medium">
                      Oculta
                    </span>
                  )}
                </div>

                {/* Type label */}
                <div className="absolute bottom-1.5 left-1.5">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-black/60 text-white">
                    {PHOTO_TYPE_LABELS[photo.photo_type] ?? photo.photo_type}
                  </span>
                </div>

                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  {!photo.is_cover && (
                    <button
                      onClick={() => handleSetCover(photo)}
                      className="p-1.5 rounded bg-orange-500 text-white hover:bg-orange-600"
                      title="Definir como capa"
                    >
                      <Crown className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleTogglePublished(photo)}
                    className="p-1.5 rounded bg-slate-600 text-white hover:bg-slate-700"
                    title={photo.published ? 'Ocultar' : 'Publicar'}
                  >
                    {photo.published
                      ? <EyeOff className="h-3.5 w-3.5" />
                      : <Eye className="h-3.5 w-3.5" />
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(photo)}
                    className="p-1.5 rounded bg-red-600 text-white hover:bg-red-700"
                    title="Remover"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
