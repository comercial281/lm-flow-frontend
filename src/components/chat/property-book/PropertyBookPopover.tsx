// PropertyBookPopover — busca imóveis do acervo que têm book salvo (PDF do
// cadastro via importação) e envia o book direto na conversa de WhatsApp.
//
// O envio é feito pelo SERVIDOR (chatService.sendPropertyBook): o backend baixa o
// PDF da book_url e anexa à mensagem, sem passar pelo upload do navegador. Nasceu
// para contornar o antigo teto de 10MB do anexo; segue valendo porque o book pode
// ter até 200MB no cadastro — acima do teto do anexo arrastado à mão.
import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@evoapi/design-system/card';
import { Button } from '@evoapi/design-system/button';
import { Building2, Search, X, Loader2, FileText, Send } from 'lucide-react';
import { toast } from 'sonner';

import { propertiesService, type Property } from '@/services/properties/propertiesService';
import { chatService } from '@/services/chat/chatService';

interface PropertyBookPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string | number;
}

export default function PropertyBookPopover({
  isOpen, onClose, conversationId,
}: PropertyBookPopoverProps) {
  const [results, setResults] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback((q: string) => {
    setLoading(true);
    // q vazio lista os imóveis ativos com book; com texto, filtra por código/título/endereço.
    return propertiesService
      .list({ q: q.trim() || undefined, status: 'active', has_book: true, per_page: 50 })
      .then(res => setResults(res.data ?? []))
      .catch(() => {
        setResults([]);
        toast.error('Erro ao buscar imóveis');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    runSearch('');
    setTimeout(() => inputRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSearchChange = useCallback((q: string) => {
    setSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 300);
  }, [runSearch]);

  async function handleSend(property: Property) {
    if (sendingId) return;
    if (!property.has_book) {
      toast.error('Este imóvel não tem book salvo');
      return;
    }
    if (!conversationId) {
      toast.error('Nenhuma conversa selecionada');
      return;
    }
    setSendingId(property.id);
    const toastId = toast.loading(`Enviando book de "${property.title}"...`);
    try {
      await chatService.sendPropertyBook(String(conversationId), property.id);
      onClose();
      toast.success(`Book de "${property.title}" enviado`, { id: toastId });
    } catch (err) {
      const msg = (err as Error)?.message ?? 'Falha no envio';
      toast.error(`Falha ao enviar book: ${msg}`, { id: toastId });
    } finally {
      setSendingId(null);
    }
  }

  if (!isOpen) return null;

  return (
    <Card className="absolute bottom-full left-0 right-0 mb-2 shadow-lg border-border z-50 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Enviar book de imóvel</span>
            {!loading && (
              <span className="text-xs text-muted-foreground">({results.length})</span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Busca */}
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Buscar por código, título ou endereço..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="max-h-[320px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Carregando...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p className="text-sm text-center">
                {search.trim()
                  ? 'Nenhum imóvel com book encontrado'
                  : 'Nenhum imóvel com book salvo ainda'}
              </p>
              {!search.trim() && (
                <p className="text-xs text-center text-muted-foreground/80 max-w-[240px]">
                  O book é salvo automaticamente quando o imóvel é cadastrado via importação de book.
                </p>
              )}
            </div>
          ) : (
            results.map(property => {
              const isSending = sendingId === property.id;
              const dimmed = sendingId && !isSending;
              return (
                <div
                  key={property.id}
                  className={`group relative transition-all duration-150 border-b border-border last:border-b-0 hover:bg-muted/50 ${
                    dimmed ? 'opacity-50' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSend(property)}
                    disabled={!!sendingId}
                    className="w-full text-left px-4 py-3 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2 mb-0.5 pr-6">
                      <FileText size={12} className="text-primary shrink-0" />
                      <span className="text-xs font-mono text-muted-foreground shrink-0">{property.code}</span>
                      <span className="text-sm font-semibold text-foreground truncate">{property.title}</span>
                    </div>
                    {property.full_address && (
                      <p className="text-xs text-muted-foreground truncate pl-5">{property.full_address}</p>
                    )}
                    {property.display_price && (
                      <p className="text-xs text-primary font-medium pl-5">{property.display_price}</p>
                    )}
                  </button>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary">
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
