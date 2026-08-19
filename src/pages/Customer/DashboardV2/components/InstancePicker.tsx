import React, { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { mayRead } from '@/store/appDataStore';
import InboxesService from '@/services/channels/inboxesService';
import type { Inbox } from '@/types/channels/inbox';

interface InstanceOption {
  id: string;
  label: string;
}

interface Props {
  value?: string;
  onChange: (inboxId: string | undefined, label: string | undefined) => void;
}

/**
 * Seletor de "de qual número (instância WhatsApp) entraram estes leads".
 *
 * Mesmo padrão do seletor rápido de instância que já existe em Conversas
 * (ChatSidebar): busca `/inboxes` só pra quem tem `inboxes.read`, e só aparece
 * com 2+ instâncias — corretor com uma instância só não tem escolha nenhuma
 * pra fazer, e o seletor ali só ensinaria que existe algo que ele não pode ter.
 */
export const InstancePicker: React.FC<Props> = ({ value, onChange }) => {
  const [options, setOptions] = useState<InstanceOption[]>([]);

  useEffect(() => {
    let alive = true;
    mayRead('inboxes.read')
      .then(pode => (pode ? InboxesService.list() : null))
      .then(res => {
        if (!alive || !res) return;
        setOptions(
          (res.data ?? []).map((i: Inbox) => {
            const canal = i.channel_type?.split('::')[1] || '';
            return { id: String(i.id), label: canal ? `${i.name} (${canal})` : i.name };
          }),
        );
      })
      .catch(() => { /* silencioso, igual ao seletor do chat */ });
    return () => {
      alive = false;
    };
  }, []);

  if (options.length < 2) return null;

  const handleChange = (id: string) => {
    if (!id) {
      onChange(undefined, undefined);
      return;
    }
    onChange(id, options.find(o => o.id === id)?.label);
  };

  return (
    <label className="lmf-select flex items-center gap-2" title="Filtrar por instância (WhatsApp)">
      <Smartphone size={14} aria-hidden />
      <span className="sr-only">Instância</span>
      <select
        value={value ?? ''}
        onChange={e => handleChange(e.target.value)}
        style={{ background: 'transparent', border: 0, color: 'inherit', font: 'inherit', outline: 'none' }}
      >
        <option value="">Todas as instâncias</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
};

export default InstancePicker;
