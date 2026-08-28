// PropertyBooks — aba dedicada (abaixo de "Imóveis") que lista os imóveis com book
// (PDF) salvo, para visualizar/baixar, e permite adicionar/trocar/remover o book
// vinculado a um imóvel já existente. Usa o filtro has_book da API + os endpoints
// de upload/remove (POST/DELETE /properties/:id/book).
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/utils/apiHelpers';
import {
  Button, Input, Badge,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/ds';
import { FileText, Search, Loader2, Download, X, Plus, Trash2, UploadCloud } from 'lucide-react';

import {
  propertiesService,
  type Property,
  PROPERTY_TYPE_LABELS,
  TRANSACTION_TYPE_LABELS,
} from '@/services/properties/propertiesService';
import PropertyBookDialog from '@/components/properties/PropertyBookDialog';

import { useConfirmacao } from '@/hooks/useConfirmacao';
export default function PropertyBooks() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [properties, setProperties] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Property | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const res = await propertiesService.list({
        q: q.trim() || undefined,
        has_book: true,
        per_page: 100,
      });
      setProperties(res.data ?? []);
      setTotal(res.meta?.total ?? (res.data ?? []).length);
    } catch {
      toast.error('Erro ao carregar books');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(''); }, [load]);

  const handleSearch = useCallback((q: string) => {
    setSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(q), 300);
  }, [load]);

  const handleRemove = useCallback(async (p: Property) => {
    if (!(await confirmar({
      titulo: 'Remover book',
      descricao: <>Remover o book de <strong>{p.title}</strong>? Esta ação não pode ser desfeita.</>,
      rotuloDaAcao: 'Remover',
      destrutivo: true,
    }))) return;
    setRemovingId(p.id);
    try {
      await propertiesService.removeBook(p.id);
      toast.success('Book removido');
      await load(search);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao remover o book'));
    } finally {
      setRemovingId(null);
    }
  }, [confirmar, load, search]);

  return (
    <>
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex items-start gap-3">
            <div
              className="w-1 h-9 rounded-full shrink-0"
              style={{ background: 'linear-gradient(to bottom, #7c3aed, #9333ea)' }}
            />
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 leading-tight">
                <FileText className="h-6 w-6 text-primary" />
                Books
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {total} imóvel{total !== 1 ? 's' : ''} com book salvo
              </p>
            </div>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar book
          </Button>
        </div>

        {/* Busca */}
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por código, título ou endereço..."
            className="pl-8 h-9 text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); load(''); }}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : properties.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <FileText className="h-10 w-10" />
            <p className="text-sm">
              {search.trim() ? 'Nenhum imóvel com book encontrado' : 'Nenhum imóvel com book salvo ainda'}
            </p>
            {!search.trim() && (
              <>
                <p className="text-xs max-w-md text-muted-foreground/80">
                  O book é salvo automaticamente na importação via book, ou você pode adicionar um manualmente.
                </p>
                <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Adicionar book
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {properties.map(p => {
              const fileName = p.book_file_name || `book-${p.code}.pdf`;
              const isRemoving = removingId === p.id;
              return (
                <div
                  key={p.id}
                  className="flex flex-col rounded-lg border border-border bg-card overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="flex-1 p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs font-mono text-muted-foreground">{p.code}</span>
                      <Badge variant="outline" className="text-xs ml-auto">
                        {TRANSACTION_TYPE_LABELS[p.transaction_type] ?? p.transaction_type}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-sm line-clamp-2 mb-1">{p.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {PROPERTY_TYPE_LABELS[p.property_type] ?? p.property_type}
                    </p>
                    {p.full_address && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{p.full_address}</p>
                    )}
                    {p.display_price && (
                      <p className="text-base font-bold text-primary mt-2">{p.display_price}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 border-t border-border p-3">
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => setSelected(p)}>
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      Ver book
                    </Button>
                    {p.book_url && (
                      <a href={p.book_url} download={fileName} target="_blank" rel="noopener noreferrer" title="Baixar book">
                        <Button size="sm" variant="outline">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      title="Remover book"
                      disabled={isRemoving}
                      onClick={() => handleRemove(p)}
                    >
                      {isRemoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <PropertyBookDialog property={selected} onClose={() => setSelected(null)} />
      )}

      {addOpen && (
        <AddBookDialog
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); load(search); }}
        />
      )}
    </div>
      {dialogoDeConfirmacao}
    </>
  );
}

// AddBookDialog — busca um imóvel (qualquer um, mesmo sem book) e sobe um PDF
// vinculado a ele. Se o imóvel já tiver book, o upload substitui.
function AddBookDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Property[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Property | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback((q: string) => {
    setSearching(true);
    propertiesService
      .list({ q: q.trim() || undefined, status: 'active', per_page: 50 })
      .then(res => setResults(res.data ?? []))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, []);

  useEffect(() => { runSearch(''); }, [runSearch]);

  const handleQuery = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 300);
  };

  const handlePickFile = (f: File | null) => {
    if (!f) { setFile(null); return; }
    if (f.type !== 'application/pdf') {
      toast.error('O book precisa ser um PDF');
      return;
    }
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!picked || !file) return;
    setUploading(true);
    setProgress(0);
    try {
      await propertiesService.uploadBook(picked.id, file, setProgress);
      toast.success(`Book vinculado a "${picked.title}"`);
      onSaved();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao subir o book'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Adicionar book
          </DialogTitle>
          <DialogDescription>Escolha um imóvel e envie o PDF do book.</DialogDescription>
        </DialogHeader>

        {/* 1. Escolher imóvel */}
        {!picked ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={e => handleQuery(e.target.value)}
                placeholder="Buscar imóvel por código, título ou endereço..."
                className="pl-8 h-9 text-sm"
              />
              {searching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {results.length === 0 ? (
                <p className="p-4 text-sm text-center text-muted-foreground">Nenhum imóvel encontrado</p>
              ) : (
                results.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPicked(p)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-2"
                  >
                    <span className="text-xs font-mono text-muted-foreground shrink-0">{p.code}</span>
                    <span className="text-sm truncate flex-1">{p.title}</span>
                    {p.has_book && <Badge variant="outline" className="text-[10px] shrink-0">tem book</Badge>}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Imóvel escolhido */}
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{picked.title}</p>
                <p className="text-xs text-muted-foreground">{picked.code}</p>
              </div>
              {picked.has_book && (
                <Badge variant="outline" className="text-[10px] shrink-0">já tem book — substitui</Badge>
              )}
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setPicked(null); setFile(null); }}>
                Trocar
              </Button>
            </div>

            {/* Escolher PDF */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={e => handlePickFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border p-6 text-muted-foreground hover:border-primary/50 hover:bg-muted/30 transition-colors disabled:opacity-60"
            >
              <UploadCloud className="h-7 w-7" />
              <span className="text-sm">{file ? file.name : 'Clique para escolher o PDF'}</span>
              {file && <span className="text-xs">{(file.size / 1024 / 1024).toFixed(1)} MB</span>}
            </button>

            {uploading && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={uploading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!picked || !file || uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-1.5" />}
            Enviar book
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
