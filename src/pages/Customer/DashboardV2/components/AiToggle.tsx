import React from 'react';
import { Bot } from 'lucide-react';

interface Props {
  active: boolean;
  onChange: (active: boolean) => void;
}

/**
 * Filtro "só o que a IA atendeu" — botão de liga/desliga, não um select: é
 * binário, não uma lista de opções pra escolher.
 */
export const AiToggle: React.FC<Props> = ({ active, onChange }) => (
  <button
    type="button"
    className="lmf-select flex items-center gap-2"
    data-active={active || undefined}
    onClick={() => onChange(!active)}
    aria-pressed={active}
    title="Mostrar só leads atendidos pela IA"
  >
    <Bot size={14} aria-hidden />
    Só IA
  </button>
);

export default AiToggle;
