import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@evoapi/design-system/popover';
import { Badge, Button, Checkbox } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import EmptyState from '@/components/base/EmptyState';
import TituloDoFiltro from '@/components/base/TituloDoFiltro';
import { labelsService } from '@/services/contacts/labelsService';
import type { User } from '@/types/users';
import SegmentadoDeLista from '@/components/base/SegmentadoDeLista';
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

  const [erroEtiquetas, setErroEtiquetas] = useState(false);
  const ultimaCarga = useRef(0);

  const carregar = useCallback(() => {
    const vez = ++ultimaCarga.current;
    setErroEtiquetas(false);
    labelsService
      .getLabels()
      .then(res => { if (vez === ultimaCarga.current) setEtiquetas((res.data || []).map(l => l.title)); })
      .catch(() => { if (vez === ultimaCarga.current) setErroEtiquetas(true); });
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

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
        <SegmentadoDeLista rotulo="Filtrar contatos" valor={pilula} aoEscolher={onPilula} opcoes={PILULAS_DE_CONTATOS} />
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
            <TituloDoFiltro htmlFor="filtro-com-etiqueta">Com a etiqueta</TituloDoFiltro>
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

          <div className="space-y-1.5 border-t pt-2">
            <TituloDoFiltro>Sem as etiquetas</TituloDoFiltro>
            {erroEtiquetas ? (
              <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={carregar} className="p-3 text-xs" />
            ) : etiquetas.length === 0 ? (
              <EmptyState tamanho="compacto" title="Nenhuma etiqueta criada." className="p-3 text-xs" />
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
            <div className="space-y-1.5 border-t pt-2">
              <TituloDoFiltro htmlFor="filtro-responsavel">Responsável</TituloDoFiltro>
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
