import { useEffect, useState } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@evoapi/design-system/popover';
import { Badge, Button, Checkbox, Label } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { labelsService } from '@/services/contacts/labelsService';
import type { User } from '@/types/users';
import {
  FILTROS_VAZIOS,
  PILULAS_DE_CONTATOS,
  SEM_RESPONSAVEL,
  quantosFiltros,
  type FiltrosDoPopover,
  type PilulaDeContatos,
} from '@/features/contatos/filtros';

interface Props {
  pilula: PilulaDeContatos;
  onPilula: (pilula: PilulaDeContatos) => void;
  filtros: FiltrosDoPopover;
  onFiltros: (filtros: FiltrosDoPopover) => void;
  /** Gestor: pílulas e o filtro de responsável. Corretor já vê só os dele. */
  daEquipe: boolean;
  users: User[];
}

// Pílulas + "Filtros" fechado, no desenho de Conversas (ver features/contatos/filtros).
export default function ContactsFiltros({ pilula, onPilula, filtros, onFiltros, daEquipe, users }: Props) {
  const [etiquetas, setEtiquetas] = useState<string[]>([]);

  useEffect(() => {
    let vivo = true;
    labelsService
      .getLabels()
      .then(res => { if (vivo) setEtiquetas((res.data || []).map(l => l.title)); })
      .catch(() => { /* sem etiquetas: o filtro de responsável segue valendo */ });
    return () => { vivo = false; };
  }, []);

  const quantos = quantosFiltros(daEquipe ? filtros : { ...filtros, responsavel: '' });
  const mudar = (patch: Partial<FiltrosDoPopover>) => onFiltros({ ...filtros, ...patch });
  const alternarSem = (titulo: string) =>
    mudar({
      semEtiquetas: filtros.semEtiquetas.includes(titulo)
        ? filtros.semEtiquetas.filter(t => t !== titulo)
        : [...filtros.semEtiquetas, titulo],
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {daEquipe && (
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
          {PILULAS_DE_CONTATOS.map(({ id, rotulo }) => {
            const ativa = pilula === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={ativa}
                onClick={() => onPilula(id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  ativa ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {rotulo}
              </button>
            );
          })}
        </div>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2" data-tour="contacts-filter-button">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {quantos > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">{quantos}</Badge>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="filtro-com-etiqueta" className="text-xs">Com a etiqueta</Label>
            <Seletor
              id="filtro-com-etiqueta"
              className="w-full"
              value={filtros.comEtiqueta}
              onChange={e => mudar({ comEtiqueta: e.target.value })}
            >
              <option value="">Qualquer etiqueta</option>
              {etiquetas.map(t => <option key={t} value={t}>{t}</option>)}
            </Seletor>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Sem as etiquetas</Label>
            {etiquetas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma etiqueta criada.</p>
            ) : (
              <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-border p-1">
                {etiquetas.map(titulo => (
                  <label
                    key={titulo}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      checked={filtros.semEtiquetas.includes(titulo)}
                      onCheckedChange={() => alternarSem(titulo)}
                    />
                    <span className="truncate">{titulo}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {daEquipe && (
            <div className="space-y-1.5">
              <Label htmlFor="filtro-responsavel" className="text-xs">Responsável</Label>
              <Seletor
                id="filtro-responsavel"
                className="w-full"
                value={pilula === 'todos' ? filtros.responsavel : ''}
                disabled={pilula !== 'todos'}
                onChange={e => mudar({ responsavel: e.target.value })}
              >
                <option value="">Qualquer responsável</option>
                <option value={SEM_RESPONSAVEL}>Sem responsável</option>
                {users.filter(u => !u.deactivated).map(u => (
                  <option key={u.id} value={String(u.id)}>{u.name}</option>
                ))}
              </Seletor>
              {pilula !== 'todos' && (
                <p className="text-[11px] text-muted-foreground">Volte para "Todos" para escolher outro responsável.</p>
              )}
            </div>
          )}

          {quantos > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFiltros(FILTROS_VAZIOS)}
              className="h-8 w-full text-muted-foreground"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Limpar filtros
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
