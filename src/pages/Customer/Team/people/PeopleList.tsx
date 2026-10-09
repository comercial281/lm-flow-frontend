import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/ds';
import { telefone } from '@/lib/formato';
import NumberChip, { DOT_CLASS, STATE_TEXT } from './NumberChip';
import { accessStatus, type AccessTone } from './accessStatus';
import { PEOPLE_FILTERS, applyPeopleFilters, filterCounts, type PeopleFilter } from './peopleFilters';
import type { TeamAccessMember } from '@/types/teamAccess';

/* A lista de Pessoas da tela de Equipe. A linha inteira abre a pessoa; o único
   botão de dentro é "Criar número", que por isso fica POR CIMA do botão que
   cobre a linha (botão dentro de botão não é válido em HTML). */

const cargoColor = (key?: string) =>
  key === 'admin' || key === 'administrador'
    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
    : key === 'manager' || key === 'gerente'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

const TONE_CLASS: Record<AccessTone, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  off: 'text-muted-foreground',
};

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

export interface PeopleListProps {
  members: TeamAccessMember[];
  /** can('channels','create'): sem ele o atalho "Criar número" some. */
  canCreateNumber: boolean;
  onOpen: (member: TeamAccessMember) => void;
  onCreateNumber: (member: TeamAccessMember) => void;
  /** Relógio injetável, para o teste. */
  now?: Date;
}

export default function PeopleList({ members, canCreateNumber, onOpen, onCreateNumber, now }: PeopleListProps) {
  const [filter, setFilter] = useState<PeopleFilter>('todas');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => filterCounts(members), [members]);
  const visible = useMemo(() => applyPeopleFilters(members, filter, query), [members, filter, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filtrar pessoas" className="flex flex-wrap gap-2">
          {PEOPLE_FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {f.label} · {counts[f.key]}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome ou celular"
            aria-label="Buscar pessoa"
            className="pl-9"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Nenhuma pessoa encontrada.</div>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border bg-card">
          {visible.map(member => {
            const access = accessStatus(member, now);
            const numbers = member.all_numbers ?? [];
            const phone = telefone(member.whatsapp_number);
            return (
              <li
                key={member.id}
                data-testid="person-row"
                className={`relative grid gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/20 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,1.6fr)_minmax(0,1fr)] md:items-center ${
                  member.deactivated ? 'opacity-60' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpen(member)}
                  aria-label={`Abrir ${member.name}`}
                  className="absolute inset-0 z-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                />

                <div className="pointer-events-none flex min-w-0 items-center gap-2.5">
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials(member.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{member.name}</div>
                    {phone
                      ? <div className="truncate text-xs text-muted-foreground">{phone}</div>
                      : <div className="truncate text-xs text-amber-600 dark:text-amber-400">Sem celular cadastrado</div>}
                  </div>
                </div>

                <div className="pointer-events-none">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cargoColor(member.role.key)}`}>
                    {member.role.name}
                  </span>
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {member.sees_all_inboxes ? (
                    <span className="pointer-events-none rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-xs text-violet-700 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300">
                      Vê todos os números
                    </span>
                  ) : numbers.length > 0 ? (
                    <span className="pointer-events-none flex min-w-0 flex-wrap items-center gap-1.5">
                      {numbers.map(n => <NumberChip key={n.inbox_id} number={n} />)}
                    </span>
                  ) : (
                    <>
                      <span className="pointer-events-none text-xs text-muted-foreground">Nenhum número</span>
                      {canCreateNumber && !member.deactivated && (
                        <button
                          type="button"
                          onClick={() => onCreateNumber(member)}
                          aria-label={`Criar número para ${member.name}`}
                          className="relative z-10 inline-flex items-center gap-1 rounded-full border border-primary/40 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"
                        >
                          <Plus className="h-3 w-3" aria-hidden="true" /> Criar número
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="pointer-events-none min-w-0">
                  <div className={`text-xs font-medium ${TONE_CLASS[access.tone]}`}>{access.label}</div>
                  {access.detail && <div className="truncate text-xs text-muted-foreground">{access.detail}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ul aria-label="Legenda" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(['connected', 'waiting', 'disconnected'] as const).map(s => (
          <li key={s} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${DOT_CLASS[s]}`} aria-hidden="true" /> {STATE_TEXT[s]}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="text-amber-500">★</span> Dono do número
        </li>
      </ul>
    </div>
  );
}
