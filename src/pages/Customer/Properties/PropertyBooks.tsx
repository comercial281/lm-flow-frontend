// PropertyBooks — aba dedicada (abaixo de "Imóveis") que lista só os imóveis
// que têm book (PDF) salvo, para visualizar e baixar. Read-only: reaproveita o
// filtro has_book da API e o PropertyBookDialog compartilhado.
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Button, Input, Badge } from '@/components/ui/ds';
import { FileText, Search, Loader2, Download, X } from 'lucide-react';

import {
  propertiesService,
  type Property,
  PROPERTY_TYPE_LABELS,
  TRANSACTION_TYPE_LABELS,
} from '@/services/properties/propertiesService';
import PropertyBookDialog from '@/components/properties/PropertyBookDialog';

export default function PropertyBooks() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Property | null>(null);
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

  return (
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
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <FileText className="h-10 w-10" />
            <p className="text-sm">
              {search.trim() ? 'Nenhum imóvel com book encontrado' : 'Nenhum imóvel com book salvo ainda'}
            </p>
            {!search.trim() && (
              <p className="text-xs max-w-md text-muted-foreground/80">
                O book é salvo automaticamente quando o imóvel é cadastrado via importação de book.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {properties.map(p => {
              const fileName = p.book_file_name || `book-${p.code}.pdf`;
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
    </div>
  );
}
