import { useEffect, useState } from 'react';
import { NotebookPen, Plus } from 'lucide-react';
import { toast } from 'sonner';

import IconActionButton from '@/components/base/IconActionButton';
import { contactsService } from '@/services/contacts/contactsService';
import { dataHora } from '@/lib/formato';
import { TEXTOS_DO_PAINEL as T } from '@/features/conversas/painelDoLead';
import Secao from './Secao';

import type { ContactNote } from '@/types/contacts';

const VISIVEIS = 3;

/** Notas do contato: o campo em cima, as 3 últimas embaixo e "Ver todas" que expande. */
export default function SecaoNotas({ contactId }: { contactId: string }) {
  const [notas, setNotas] = useState<ContactNote[]>([]);
  const [nova, setNova] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [todas, setTodas] = useState(false);

  useEffect(() => {
    let vivo = true;
    setNotas([]);
    setTodas(false);
    contactsService
      .getContactNotes(contactId)
      .then(res => { if (vivo) setNotas(res.data ?? []); })
      .catch(() => { if (vivo) setNotas([]); });
    return () => { vivo = false; };
  }, [contactId]);

  const salvar = async () => {
    const texto = nova.trim();
    if (!texto || salvando) return;
    setSalvando(true);
    try {
      const criada = await contactsService.createContactNote(contactId, texto);
      setNotas(prev => [criada, ...prev]);
      setNova('');
    } catch {
      toast.error(T.erroAoSalvarNota);
    } finally {
      setSalvando(false);
    }
  };

  const visiveis = todas ? notas : notas.slice(0, VISIVEIS);

  return (
    <Secao titulo={T.notas} icone={{ Icone: NotebookPen, tom: 'laranja' }}>
      <div className="flex items-center gap-2">
        <input
          className="flex-1 min-w-0 text-sm border border-border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={T.escrevaUmaNota}
          aria-label={T.escrevaUmaNota}
          value={nova}
          onChange={e => setNova(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') salvar(); }}
        />
        <IconActionButton
          label={T.salvarNota}
          icon={<Plus className="h-4 w-4" />}
          onClick={salvar}
          disabled={salvando || !nova.trim()}
          className="h-8 w-8"
        />
      </div>

      {notas.length === 0 ? (
        <p className="text-xs text-muted-foreground">{T.semNotas}</p>
      ) : (
        <div className="space-y-2">
          {visiveis.map(nota => (
            <div key={nota.id} className="text-xs">
              <p className="lm-redact whitespace-pre-wrap break-words">{nota.content}</p>
              {nota.created_at && <p className="text-muted-foreground mt-0.5">{dataHora(nota.created_at)}</p>}
            </div>
          ))}
          {notas.length > VISIVEIS && (
            <button type="button" onClick={() => setTodas(t => !t)} className="text-xs text-primary hover:underline">
              {todas ? T.verMenos : T.verTodas}
            </button>
          )}
        </div>
      )}
    </Secao>
  );
}
