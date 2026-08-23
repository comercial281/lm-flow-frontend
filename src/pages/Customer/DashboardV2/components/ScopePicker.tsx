import React from 'react';
import { Users } from 'lucide-react';
import type { ScopeInfo, ScopeMode } from '../types';

/**
 * Seletor de "de quem são estes números".
 *
 * Só existe pra quem tem escolha. O corretor recebe `locked: true` e um único
 * modo disponível — desenhar um select travado ali só ensinaria que existe algo
 * que ele não pode ter.
 *
 * A lista de modos vem do SERVIDOR (`available_modes`), não de uma tabela aqui:
 * quem decide o recorte é o backend, e um seletor que oferecesse opção a mais
 * mandaria o usuário pedir algo que volta recortado igual — parecendo bug.
 */
const LABELS: Record<ScopeMode, string> = {
  mine: 'Minha carteira',
  team: 'Minha equipe',
  all: 'Toda a imobiliária',
};

interface Props {
  scope?: ScopeInfo;
  onChange: (mode: ScopeMode) => void;
}

export const ScopePicker: React.FC<Props> = ({ scope, onChange }) => {
  if (!scope || scope.locked || scope.available_modes.length < 2) return null;

  return (
    <label className="lmf-select flex items-center gap-2" title="De quem são os números">
      <Users size={14} aria-hidden />
      <span className="sr-only">De quem são os números</span>
      <select
        value={scope.mode}
        onChange={e => onChange(e.target.value as ScopeMode)}
        style={{ background: 'transparent', border: 0, color: 'inherit', font: 'inherit', outline: 'none' }}
      >
        {scope.available_modes.map(mode => (
          <option key={mode} value={mode}>
            {LABELS[mode]}
          </option>
        ))}
      </select>
    </label>
  );
};

export default ScopePicker;
