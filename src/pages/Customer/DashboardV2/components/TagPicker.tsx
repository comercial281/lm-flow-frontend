import React, { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';

interface LabelOption {
  id: string;
  title: string;
  color: string;
}

interface Props {
  value?: string;
  onChange: (labelId: string | undefined, title: string | undefined) => void;
}

/**
 * Seletor de "por qual etiqueta do CRM filtrar" (`lead-quente`, `follow-up-1`,
 * `meta-ads` etc.). Mesma família dos seletores de instância/IA — some sozinho
 * quando o tenant não tem etiqueta nenhuma cadastrada.
 *
 * `page_size` grande pra trazer tudo numa request só: `/labels` é PAGINADO
 * (20 por página por padrão) — sem isso, um tenant com mais de 20 etiquetas
 * perdia as últimas em ordem alfabética (achado ao vivo: "tráfego" sumia com
 * 37 etiquetas cadastradas e o default de 20).
 */
export const TagPicker: React.FC<Props> = ({ value, onChange }) => {
  const [options, setOptions] = useState<LabelOption[]>([]);

  useEffect(() => {
    let alive = true;
    api.get('/labels', { params: { page_size: 500 } })
      .then(res => {
        if (!alive) return;
        const list = extractData<LabelOption[]>(res) ?? [];
        setOptions(list.map(l => ({ id: String(l.id), title: l.title, color: l.color })));
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

  const selected = options.find(o => o.id === value);

  return (
    <label className="lmf-select flex items-center gap-2" title="Filtrar por etiqueta">
      {/* Bolinha na cor da etiqueta selecionada — o <select> nativo não deixa
          colorir o valor fechado, só as opções da lista aberta. */}
      {selected ? (
        <span
          aria-hidden
          style={{ width: 10, height: 10, borderRadius: '50%', background: selected.color, flexShrink: 0 }}
        />
      ) : (
        <Tag size={14} aria-hidden />
      )}
      <span className="sr-only">Etiqueta</span>
      <select
        value={value ?? ''}
        onChange={e => handleChange(e.target.value)}
        style={{ background: 'transparent', border: 0, color: 'inherit', font: 'inherit', outline: 'none' }}
      >
        <option value="">Todas as etiquetas</option>
        {options.map(o => (
          <option key={o.id} value={o.id} style={{ color: o.color }}>
            {o.title}
          </option>
        ))}
      </select>
    </label>
  );
};

export default TagPicker;
