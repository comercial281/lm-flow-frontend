import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/ds';
import {
  Loader2,
  MessageSquare,
  User as UserIcon,
  Building2,
  CornerDownLeft,
} from 'lucide-react';
import useGlobalSearch from '@/hooks/chat/useGlobalSearch';
import { propertiesService, type Property } from '@/services/properties/propertiesService';
import type { MenuItem } from '@/components/layout/config/menuItems';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Itens de menu JÁ filtrados por permissão/feature (vindos do MainLayout). */
  menuItems: MenuItem[];
}

const MIN_QUERY_LENGTH = 2;
const SECTION_LIMIT = 5;

/** Achata o menu (itens + subitens) em alvos de navegação únicos. */
function flattenMenu(menuItems: MenuItem[]): Array<{ name: string; href: string; icon: MenuItem['icon'] }> {
  const out: Array<{ name: string; href: string; icon: MenuItem['icon'] }> = [];
  const seen = new Set<string>();
  for (const item of menuItems) {
    if (item.href && item.href !== '#' && !seen.has(item.href)) {
      seen.add(item.href);
      out.push({ name: item.name, href: item.href, icon: item.icon });
    }
    for (const sub of item.subItems ?? []) {
      if (sub.href && sub.href !== '#' && !seen.has(sub.href)) {
        seen.add(sub.href);
        out.push({ name: sub.name, href: sub.href, icon: sub.icon });
      }
    }
  }
  return out;
}

export default function GlobalCommandPalette({ open, onOpenChange, menuItems }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  // Limpa a busca ao fechar.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebounced('');
    }
  }, [open]);

  // Debounce do termo (300ms) pra não martelar a API.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Busca conversas/contatos/mensagens (reusa a infra do chat).
  const { status, conversations, contacts } = useGlobalSearch(debounced);

  // Busca imóveis (não tem página de detalhe → leva pra lista já filtrada).
  const [properties, setProperties] = useState<Property[]>([]);
  const [propLoading, setPropLoading] = useState(false);
  useEffect(() => {
    if (debounced.length < MIN_QUERY_LENGTH) {
      setProperties([]);
      setPropLoading(false);
      return;
    }
    let active = true;
    setPropLoading(true);
    propertiesService
      .list({ q: debounced, per_page: SECTION_LIMIT })
      .then(res => {
        if (active) setProperties(res.data ?? []);
      })
      .catch(() => {
        if (active) setProperties([]);
      })
      .finally(() => {
        if (active) setPropLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debounced]);

  const navItems = useMemo(() => flattenMenu(menuItems), [menuItems]);
  const term = query.trim().toLowerCase();
  const filteredNav = useMemo(() => {
    if (!term) return navItems;
    return navItems.filter(n => n.name.toLowerCase().includes(term));
  }, [navItems, term]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const isSearching = debounced.length >= MIN_QUERY_LENGTH;
  const loading = isSearching && (status === 'loading' || propLoading);
  const noResults =
    isSearching &&
    !loading &&
    filteredNav.length === 0 &&
    conversations.length === 0 &&
    contacts.length === 0 &&
    properties.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-2xl">
        <DialogTitle className="sr-only">Busca global</DialogTitle>
        <Command shouldFilter={false} className="max-h-[60vh]">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar conversas, contatos, imóveis ou ir para uma seção..."
          />

          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground border-b">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Buscando...</span>
            </div>
          )}

          <CommandList>
            {noResults && <CommandEmpty>Nada encontrado para "{query}".</CommandEmpty>}

            {/* Navegação rápida (sempre que houver match; tudo quando vazio) */}
            {filteredNav.length > 0 && (
              <CommandGroup heading="Ir para">
                {filteredNav.map(n => {
                  const Icon = n.icon;
                  return (
                    <CommandItem
                      key={`nav-${n.href}`}
                      value={`nav-${n.href}`}
                      onSelect={() => go(n.href)}
                      className="flex items-center gap-3 py-2 cursor-pointer"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{n.name}</span>
                      <CornerDownLeft className="h-3 w-3 text-muted-foreground opacity-0 aria-selected:opacity-100" />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {/* Resultados de busca (só com 2+ caracteres) */}
            {isSearching && conversations.length > 0 && (
              <CommandGroup heading="Conversas">
                {conversations.slice(0, SECTION_LIMIT).map(c => {
                  const name = c.contact?.name || `Conversa #${c.display_id}`;
                  const sub = c.contact?.phone_number || c.contact?.email || c.inbox?.name || '';
                  return (
                    <CommandItem
                      key={`conv-${c.id}`}
                      value={`conv-${c.id}`}
                      onSelect={() => go(`/conversations/${c.id}`)}
                      className="flex items-start gap-3 py-2 cursor-pointer"
                    >
                      <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{name}</div>
                        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {isSearching && contacts.length > 0 && (
              <CommandGroup heading="Contatos">
                {contacts.slice(0, SECTION_LIMIT).map(c => {
                  const sub = c.phone_number || c.email || c.identifier || '';
                  return (
                    <CommandItem
                      key={`contact-${c.id}`}
                      value={`contact-${c.id}`}
                      onSelect={() => go(`/contacts/${c.id}`)}
                      className="flex items-start gap-3 py-2 cursor-pointer"
                    >
                      <UserIcon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{c.name}</div>
                        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {isSearching && properties.length > 0 && (
              <CommandGroup heading="Imóveis">
                {properties.slice(0, SECTION_LIMIT).map(p => {
                  const sub = [p.code, p.address_city, p.display_price].filter(Boolean).join(' · ');
                  return (
                    <CommandItem
                      key={`prop-${p.id}`}
                      value={`prop-${p.id}`}
                      onSelect={() => go(`/properties?q=${encodeURIComponent(p.code || p.title)}`)}
                      className="flex items-start gap-3 py-2 cursor-pointer"
                    >
                      <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{p.title}</div>
                        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
