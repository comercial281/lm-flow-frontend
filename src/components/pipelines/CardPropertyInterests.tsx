import { useState, useEffect, useCallback } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { Button, Input, Badge } from '@evoapi/design-system';
import { Plus, Trash2, Loader2, Search, Home, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  propertyInterestsService,
  type PropertyInterest,
  INTEREST_STAGE_LABELS,
  INTEREST_STAGE_COLORS,
} from '@/services/propertyInterests/propertyInterestsService';
import { propertiesService, type Property } from '@/services/properties/propertiesService';
import type { PipelineItem } from '@/types/analytics';

interface CardPropertyInterestsProps {
  item: PipelineItem;
  onValueChange?: (value: number, formatted: string) => void;
}

function formatBRL(n?: number | null) {
  if (!n) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

export default function CardPropertyInterests({ item, onValueChange }: CardPropertyInterestsProps) {
  const contactId = item.contact?.id ?? (item.conversation as any)?.contact?.id;

  const [interests, setInterests] = useState<PropertyInterest[]>([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Property[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);
    try {
      const res = await propertyInterestsService.listByContact(String(contactId));
      const list = res.data ?? [];
      setInterests(list);

      // Notify parent with total value
      const total = list.reduce((sum, i) => {
        const price = i.property?.display_price ?? '';
        // Try to extract numeric from display_price, fall back to 0
        const num = parseFloat(price.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        return sum + num;
      }, 0);
      onValueChange?.(total, formatBRL(total));
    } catch {
      setInterests([]);
    } finally {
      setLoading(false);
    }
  }, [contactId, onValueChange]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    setSearching(true);
    try {
      // q vazio lista todos os imóveis ativos (ao clicar/focar); com texto, filtra
      const res = await propertiesService.list({ q: q.trim() || undefined, status: 'active', per_page: 50 });
      setSearchResults(res.data ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleAdd = useCallback(async (property: Property) => {
    if (!contactId) return;
    setAdding(property.id);
    try {
      await propertyInterestsService.create({
        contact_id: String(contactId),
        property_id: property.id,
        interest_stage: 'interested',
      });
      toast.success(`${property.title} adicionado`);
      setSearchQuery('');
      setSearchResults([]);
      setSearchOpen(false);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao adicionar imóvel'));
    } finally {
      setAdding(null);
    }
  }, [contactId, load]);

  const handleRemove = useCallback(async (interestId: string) => {
    setRemoving(interestId);
    try {
      await propertyInterestsService.delete(interestId);
      toast.success('Imóvel removido');
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao remover'));
    } finally {
      setRemoving(null);
    }
  }, [load]);

  // Compute total value from sale/rent prices fetched in interests
  const totalValue = interests.reduce((sum, i) => {
    if (!i.property) return sum;
    // display_price is a formatted string — try to parse, or fall back 0
    const raw = (i.property as any).sale_price ?? (i.property as any).rent_price ?? 0;
    return sum + (typeof raw === 'number' ? raw : 0);
  }, 0);

  if (!contactId) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Home className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Sem contato vinculado a este card.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => { setSearchOpen(true); handleSearch(searchQuery); }}
              placeholder="Buscar imóvel por código ou título..."
              className="pl-8 h-9 text-sm"
            />
            {searching && (
              <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {searchQuery && (
            <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchOpen(false); }}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Search dropdown */}
        {searchOpen && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
            {searchResults.map(p => {
              const alreadyAdded = interests.some(i => i.property_id === p.id);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/50 border-b border-border last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-muted-foreground">{p.code}</span>
                      <span className="text-sm font-medium truncate">{p.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      {p.address_neighborhood && <span>{p.address_neighborhood}</span>}
                      {p.display_price && <span className="text-green-600 dark:text-green-400 font-medium">{p.display_price}</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={alreadyAdded ? 'ghost' : 'outline'}
                    className="h-7 text-xs shrink-0"
                    disabled={alreadyAdded || adding === p.id}
                    onClick={() => !alreadyAdded && handleAdd(p)}
                  >
                    {adding === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : alreadyAdded ? 'Adicionado' : <Plus className="h-3 w-3" />}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Total value */}
      {interests.length > 0 && totalValue > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-900/10 px-3 py-2">
          <span className="text-xs text-muted-foreground font-medium">Valor total do lead</span>
          <span className="text-sm font-bold text-green-600 dark:text-green-400">{formatBRL(totalValue)}</span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : interests.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Home className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum imóvel vinculado ainda.</p>
          <p className="text-xs text-muted-foreground">Use a busca acima para adicionar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {interests.map(interest => (
            <div key={interest.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
              <Home className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {interest.property?.code && (
                    <span className="text-[10px] font-mono text-muted-foreground">{interest.property.code}</span>
                  )}
                  <span className="text-sm font-medium truncate">{interest.property?.title ?? '—'}</span>
                </div>
                {(interest.property?.city || interest.property?.neighborhood) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[interest.property?.neighborhood, interest.property?.city].filter(Boolean).join(', ')}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {interest.property?.display_price && (
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                      {interest.property.display_price}
                    </span>
                  )}
                  <Badge className={`text-[10px] h-4 px-1.5 ${INTEREST_STAGE_COLORS[interest.interest_stage] ?? ''}`}>
                    {INTEREST_STAGE_LABELS[interest.interest_stage] ?? interest.interest_stage}
                  </Badge>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemove(interest.id)}
                disabled={removing === interest.id}
              >
                {removing === interest.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
