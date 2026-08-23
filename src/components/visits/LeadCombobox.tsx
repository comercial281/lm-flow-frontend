import { useEffect, useRef, useState } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import {
  Input,
  Button,
  Label as UILabel,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/ds';
import { Search, ChevronDown, UserPlus, User as UserIcon, KanbanSquare } from 'lucide-react';
import { toast } from 'sonner';
import { visitsService, LeadPickerItem } from '@/services/visits/visitsService';

interface Props {
  value: LeadPickerItem | null;
  onChange: (lead: LeadPickerItem) => void;
  placeholder?: string;
  label?: string;
}

export function LeadCombobox({ value, onChange, placeholder = 'Buscar lead ou contato...', label = 'Contato *' }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LeadPickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchList = (q: string) => {
    setLoading(true);
    visitsService.leadPicker(q, 20)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) fetchList('');
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!open) return;
    debounceRef.current = setTimeout(() => fetchList(query), 250);
  }, [query, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const handleQuickCreate = async () => {
    if (!quickName.trim() || !quickPhone.trim()) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }
    setQuickSaving(true);
    try {
      const created = await visitsService.quickCreateContact({
        name: quickName.trim(),
        phone_number: quickPhone.trim(),
      });
      toast.success('Contato criado');
      onChange(created);
      setQuickOpen(false);
      setQuickName('');
      setQuickPhone('');
      setOpen(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao criar contato'));
    } finally {
      setQuickSaving(false);
    }
  };

  return (
    <>
      <div className="relative" ref={wrapperRef}>
        <UILabel>{label}</UILabel>
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={value && !open ? `${value.name}${value.phone_number ? ` · ${value.phone_number}` : ''}` : query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="pl-9"
          />
          {loading && (
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>

        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-72 overflow-y-auto">
            {items.length === 0 && !loading && (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                Nenhum lead encontrado
              </div>
            )}
            {items.map(item => (
              <button
                key={item.id}
                type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b border-border last:border-0"
                onClick={() => { onChange(item); setOpen(false); setQuery(''); }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm truncate flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    {item.name}
                  </div>
                  {item.in_pipeline && (
                    <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1 flex-shrink-0">
                      <KanbanSquare className="h-2.5 w-2.5" />
                      {item.stage_name ?? 'kanban'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {[item.phone_number, item.email].filter(Boolean).join(' · ') || '—'}
                </div>
              </button>
            ))}

            {/* Sticky "criar novo" */}
            <button
              type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-primary/5 border-t border-border text-sm font-medium text-primary flex items-center gap-2 sticky bottom-0 bg-popover"
              onClick={() => { setQuickOpen(true); setOpen(false); }}
            >
              <UserPlus className="h-4 w-4" />
              Criar contato novo
            </button>
          </div>
        )}
      </div>

      {/* Quick create modal */}
      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar contato novo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <UILabel>Nome *</UILabel>
              <Input value={quickName} onChange={e => setQuickName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <UILabel>Telefone *</UILabel>
              <Input
                value={quickPhone}
                onChange={e => setQuickPhone(e.target.value)}
                placeholder="+5511999999999"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickOpen(false)}>Cancelar</Button>
            <Button onClick={handleQuickCreate} disabled={quickSaving}>
              {quickSaving ? 'Salvando...' : 'Criar e selecionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
