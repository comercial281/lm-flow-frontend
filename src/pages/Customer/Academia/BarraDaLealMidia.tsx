// Faixa só da Leal Mídia no topo da Área de Membros: "Ver como" e, como
// Administrador, as ações de montar (vêm em `children`).

import type { ReactNode } from 'react';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import type { CargoNaAcademia } from './quemVe';
import { useCargoNaAcademia } from './useCargoNaAcademia';
import { definirVerComo } from './verComo';

const OPCOES: { valor: CargoNaAcademia; rotulo: string }[] = [
  { valor: 'admin', rotulo: 'Administrador' },
  { valor: 'gestor', rotulo: 'Gestor' },
  { valor: 'corretor', rotulo: 'Corretor' },
];

export default function BarraDaLealMidia({ children }: { children?: ReactNode }) {
  const { cargo, podeEditar, ehLealMidia } = useCargoNaAcademia();
  if (!ehLealMidia) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-primary/5 px-5 py-2.5 md:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Ver como</span>
        <BotoesDeEscolha rotulo="Ver como" valor={cargo} opcoes={OPCOES}
          aoEscolher={(c) => definirVerComo(c === 'admin' ? null : c)} />
      </div>
      {podeEditar && children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
