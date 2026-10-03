import { useEffect, useRef, useState, type UIEvent } from 'react';
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
import { numero, telefone } from '@/lib/formato';
import { PhoneInput } from '@/components/shared/PhoneInput';

interface Props {
  value: LeadPickerItem | null;
  onChange: (lead: LeadPickerItem) => void;
  placeholder?: string;
  label?: string;
  /** "Criar contato novo" no fim da lista. A visita não cadastra cliente (decisão do dono, 30/09). */
  allowCreate?: boolean;
  /**
   * Lista paginada (Agendar visita): 50 por vez, carrega mais ao rolar até o
   * fim e mostra o total no rodapé. Sem isso (Propostas), continua a busca
   * simples de 20.
   */
  paginated?: boolean;
}

/**
 * Cliente sem nome de verdade: o servidor manda o telefone no lugar do nome
 * (às vezes cru, `5511999990000`). Aí o nome mostrado é o telefone formatado,
 * e ele não se repete na linha de baixo nem no campo escolhido.
 */
export function nomeDoCliente(item: Pick<LeadPickerItem, 'name' | 'phone_number'>): { nome: string; ehTelefone: boolean } {
  const nome = (item.name ?? '').trim();
  const fone = (item.phone_number ?? '').trim();
  const ehTelefone = nome === '' || (fone !== '' && nome === fone) || /^[\d+\s]+$/.test(nome);
  if (!ehTelefone) return { nome, ehTelefone: false };
  return { nome: telefone(fone || nome) || nome, ehTelefone: true };
}

/** Texto do campo depois de escolhido: "Nome · (11) 99999-0000", ou só o telefone. */
export function textoEscolhido(item: Pick<LeadPickerItem, 'name' | 'phone_number'>): string {
  const { nome, ehTelefone } = nomeDoCliente(item);
  if (ehTelefone) return nome;
  return [nome, telefone(item.phone_number)].filter(Boolean).join(' · ');
}

/** Linha de baixo da lista: telefone e e-mail, sem repetir o telefone que já é o nome. */
function linhaDeBaixo(item: LeadPickerItem): string {
  const { ehTelefone } = nomeDoCliente(item);
  return [ehTelefone ? '' : telefone(item.phone_number), item.email].filter(Boolean).join(' · ');
}

const POR_PAGINA = 50;
/** Distância do fim da lista (px) em que a próxima página já é pedida. */
const PERTO_DO_FIM = 80;

export function LeadCombobox({
  value, onChange, placeholder = 'Buscar lead ou contato...', label = 'Contato *', allowCreate = true,
  paginated = false,
}: Props) {
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
  // Paginado: total do recorte, se há mais páginas e qual foi a última pedida.
  const [total, setTotal] = useState<number | null>(null);
  const [temMais, setTemMais] = useState(false);
  const paginaRef = useRef(1);
  // Busca em vigor e o número dela: resposta de busca antiga (ou página
  // seguinte de busca antiga) chega depois da nova e é descartada.
  const consultaRef = useRef<string | null>(null);
  const pedidoRef = useRef(0);
  const carregandoMaisRef = useRef(false);

  const fetchList = (q: string) => {
    if (!paginated) {
      setLoading(true);
      visitsService.leadPicker(q, 20)
        .then(setItems)
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
      return;
    }
    const pedido = ++pedidoRef.current;
    consultaRef.current = q;
    carregandoMaisRef.current = false;
    paginaRef.current = 1;
    setLoading(true);
    visitsService.leadPickerPage(q, 1, POR_PAGINA)
      .then(({ data, meta }) => {
        if (pedido !== pedidoRef.current) return;
        setItems(data);
        setTotal(meta.total ?? null);
        setTemMais(!!meta.has_more);
      })
      .catch(() => {
        if (pedido !== pedidoRef.current) return;
        setItems([]);
        setTotal(null);
        setTemMais(false);
      })
      .finally(() => { if (pedido === pedidoRef.current) setLoading(false); });
  };

  const carregarMais = () => {
    if (!paginated || !temMais || loading || carregandoMaisRef.current) return;
    const pedido = pedidoRef.current;
    const proxima = paginaRef.current + 1;
    carregandoMaisRef.current = true;
    visitsService.leadPickerPage(consultaRef.current ?? '', proxima, POR_PAGINA)
      .then(({ data, meta }) => {
        if (pedido !== pedidoRef.current) return;
        paginaRef.current = proxima;
        setItems(atuais => {
          const vistos = new Set(atuais.map(i => i.id));
          return [...atuais, ...data.filter(i => !vistos.has(i.id))];
        });
        if (meta.total !== undefined) setTotal(meta.total);
        setTemMais(!!meta.has_more);
      })
      .catch(() => { /* fica na página que já tem; rolar de novo tenta outra vez */ })
      .finally(() => { if (pedido === pedidoRef.current) carregandoMaisRef.current = false; });
  };

  const aoRolar = (e: UIEvent<HTMLDivElement>) => {
    if (!paginated) return;
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= PERTO_DO_FIM) carregarMais();
  };

  useEffect(() => {
    if (open) fetchList('');
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!open) return;
    // Paginado: abrir já pediu essa mesma busca; repetir voltaria para a
    // página 1 por cima de quem já rolou.
    if (paginated && query === consultaRef.current) return;
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
            value={value && !open ? textoEscolhido(value) : query}
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
          <div
            role="group"
            aria-label="Resultados da busca"
            onScroll={aoRolar}
            className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-72 overflow-y-auto"
          >
            {items.length === 0 && !loading && (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                {allowCreate ? 'Nenhum lead encontrado' : 'Nenhum cliente seu com esse nome ou telefone'}
              </div>
            )}
            {items.map(item => {
              const { nome, ehTelefone } = nomeDoCliente(item);
              const abaixo = linhaDeBaixo(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b border-border last:border-0"
                  onClick={() => { onChange(item); setOpen(false); setQuery(''); }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm truncate flex items-center gap-1.5">
                      <UserIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      {nome}
                    </div>
                    {item.in_pipeline && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1 flex-shrink-0">
                        <KanbanSquare className="h-2.5 w-2.5" />
                        {item.stage_name ?? 'kanban'}
                      </span>
                    )}
                  </div>
                  {(abaixo || !ehTelefone) && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {abaixo || '—'}
                    </div>
                  )}
                </button>
              );
            })}

            {paginated && total !== null && items.length > 0 && (
              <div className="sticky bottom-0 bg-popover border-t border-border px-3 py-2 text-xs text-muted-foreground">
                Mostrando {numero(items.length)} de {numero(total)}{temMais ? ' — digite para buscar' : ''}
              </div>
            )}

            {/* Sticky "criar novo" */}
            {allowCreate && (
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-primary/5 border-t border-border text-sm font-medium text-primary flex items-center gap-2 sticky bottom-0 bg-popover"
                onClick={() => { setQuickOpen(true); setOpen(false); }}
              >
                <UserPlus className="h-4 w-4" />
                Criar contato novo
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick create modal */}
      {allowCreate && (
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
                <PhoneInput
                  value={quickPhone}
                  onChange={setQuickPhone}
                  placeholder="(11) 99999-9999"
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
      )}
    </>
  );
}
