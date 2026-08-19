import React, { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';

interface LabelOption {
  id: string;
  title: string;
}

interface Props {
  value?: string;
  onChange: (labelId: string | undefined, title: string | undefined) => void;
}

/**
 * Seletor de "por qual etiqueta do CRM filtrar" (`lead-quente`, `follow-up-1`,
 * `meta-ads` etc.). Mesma família dos seletores de instância/IA — some sozinho
 * quando o tenant não tem etiqueta nenhuma cadastrada.
 */
export const TagPicker: React.FC<Props> = ({ value, onChange }) => {
  const [options, setOptions] = useState<LabelOption[]>([]);

  useEffect(() => {
    let alive = true;
    api.get('/labels')
      .then(res => {
        if (!alive) return;
        const list = extractData<LabelOption[]>(res) ?? [];
        setOptions(list.map(l => ({ id: String(l.id), title: l.title })));
      })
      .catch(() => { /* silencioso, igual ao seletor de instância */ });
    return () => {
      alive = false;
    };
  }, []);

  if (options.length === 0) return null;

  const handleChange = (id: string) => {
    if (!id) {
      onChange(undefined, undefined);
      return;
    }
    onChange(id, options.find(o => o.id === id)?.title);
  };

  return (
    <label className="lmf-select flex items-center gap-2" title="Filtrar por etiqueta">
      <Tag size={14} aria-hidden />
      <span className="sr-only">Etiqueta</span>
      <select
        value={value ?? ''}
        onChange={e => handleChange(e.target.value)}
        style={{ background: 'transparent', border: 0, color: 'inherit', font: 'inherit', outline: 'none' }}
      >
        <option value="">Todas as etiquetas</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>
            {o.title}
          </option>
        ))}
      </select>
    </label>
  );
};

export default TagPicker;
