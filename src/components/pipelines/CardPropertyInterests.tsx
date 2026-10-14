import { useState, useEffect, useCallback } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { Button, Input } from '@/components/ui/ds';
import { Plus, Loader2, Search, Home, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  propertyInterestsService,
  type PropertyInterest,
} from '@/services/propertyInterests/propertyInterestsService';
import { propertiesService, type Property } from '@/services/properties/propertiesService';
import type { PipelineItem } from '@/types/analytics';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAgendarVisitaDoCard } from '@/features/cardDoLead/useAgendarVisitaDoCard';
import CartaoDoImovelDeInteresse from './card/CartaoDoImovelDeInteresse';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';

interface CardPropertyInterestsProps {
  item: PipelineItem;
  /** Nome do lead na janela de visita. Sem ele, usa o nome do contato do item. */
  nomeExibido?: string;
  /** Chamado quando uma visita é criada pelo cartão (o card recarrega o histórico). */
  onVisitaCriada?: () => void;
  /** Chamado quando a lista carrega ou muda (título da caixa mostra a contagem). */
  aoContar?: (n: number) => void;
  /** Janela do card: cartões compactos (a página do card usa os normais). */
  compacto?: boolean;
}

export default function CardPropertyInterests({ item, nomeExibido, onVisitaCriada, aoContar, compacto }: CardPropertyInterestsProps) {
  const contactId = item.contact?.id ?? (item.conversation as any)?.contact?.id;
  const { can } = useUserPermissions();
  const podeEditar = can('properties', 'update');
  const nome = nomeExibido ?? item.contact?.name ?? (item.conversation as any)?.contact?.name ?? '';
  const visita = useAgendarVisitaDoCard(item, nome, onVisitaCriada);

  const [interests, setInterests] = useState<PropertyInterest[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(false);
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

      aoContar?.(list.length);
      setErro(false);
    } catch {
      setInterests([]);
      setErro(true);
    } finally {
      setLoading(false);
    }
  }, [contactId, aoContar]);

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

  const handleChangeStage = useCallback(async (interestId: string, stage: PropertyInterest['interest_stage']) => {
    try {
      await propertyInterestsService.update(interestId, { interest_stage: stage });
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não foi possível mudar o status'));
    }
  }, [load]);

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

  if (!contactId) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Home className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Sem contato vinculado a este card.</p>
      </div>
    );
  }

  return (
    <div className="@container grid gap-3">
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
            <Button
              size="sm"
              variant="ghost"
              className="h-9 px-2"
              onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchOpen(false); }}
              aria-label="Limpar busca"
              title="Limpar busca"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Search dropdown */}
        {searchOpen && searchResults.length > 0 && (
          <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-background">
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
                    className="text-xs shrink-0"
                    aria-label={alreadyAdded ? 'Imóvel já adicionado' : 'Adicionar imóvel'}
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

      {/* List */}
      {loading ? (
        <Carregando linhas={2} />
      ) : erro ? (
        <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={() => void load()} />
      ) : interests.length === 0 ? (
        <EmptyState tamanho="compacto" title="Nenhum imóvel vinculado ainda." description="Busque acima pelo código ou título." />
      ) : (
        <div
          data-testid="fileira-de-imoveis"
          className="grid grid-flow-col auto-cols-[85%] @2xl:auto-cols-[calc((100%-1.5rem)/3)] gap-3 overflow-x-auto pb-1"
        >
          {interests.map(i => (
            <CartaoDoImovelDeInteresse
              key={i.id}
              interesse={i}
              podeEditar={podeEditar}
              aoAgendarVisita={visita.abrir}
              aoMudarSituacao={handleChangeStage}
              aoRemover={handleRemove}
              removendo={removing === i.id}
              compacto={compacto}
            />
          ))}
        </div>
      )}
      {visita.janela}
    </div>
  );
}
