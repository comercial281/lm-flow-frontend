import React, { useEffect, useId, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { mayRead } from '@/store/appDataStore';
import InboxesService from '@/services/channels/inboxesService';
import type { Inbox } from '@/types/channels/inbox';
import { CampoFiltro } from './CampoFiltro';

interface InstanceOption {
  id: string;
  label: string;
}

interface Props {
  value?: string;
  onChange: (inboxId: string | undefined, label: string | undefined) => void;
  /** Com rótulo, desenha o campo da Dashboard nova (rótulo em cima, caixa de 40 px). Sem, o de sempre. */
  rotulo?: string;
}

/**
 * Seletor de "de qual número (instância WhatsApp) entraram estes leads".
 *
 * Mesmo padrão do seletor rápido de instância que já existe em Conversas
 * (ChatSidebar): busca `/inboxes` só pra quem tem `inboxes.read`, e só aparece
 * com 2+ instâncias — corretor com uma instância só não tem escolha nenhuma
 * pra fazer, e o seletor ali só ensinaria que existe algo que ele não pode ter.
 */
export const InstancePicker: React.FC<Props> = ({ value, onChange, rotulo }) => {
  const [options, setOptions] = useState<InstanceOption[]>([]);
  const id = useId();

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

  const opcoes = (
    <>
      <option value="">Todos os números</option>
      {options.map(o => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </>
  );

  if (rotulo) {
    return (
      <CampoFiltro id={id} rotulo={rotulo} icone={<Smartphone size={14} />}>
        <select id={id} className="lmf-campo-controle" data-active={value ? true : undefined}
          value={value ?? ''} onChange={e => handleChange(e.target.value)}>
          {opcoes}
        </select>
      </CampoFiltro>
    );
  }

  return (
    <label className="lmf-select flex items-center gap-2" title="Filtrar por número de WhatsApp">
      <Smartphone size={14} aria-hidden />
      <span className="sr-only">Número</span>
      <select
        value={value ?? ''}
        onChange={e => handleChange(e.target.value)}
        style={{ background: 'transparent', border: 0, color: 'inherit', font: 'inherit', outline: 'none' }}
      >
        {opcoes}
      </select>
    </label>
  );
};

export default InstancePicker;
