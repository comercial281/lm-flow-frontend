// "Avançado" das janelas de curso e módulo: o cadeado de venda e a liberação por
// cliente/e-mail. Começa fechado (ninguém usa no dia a dia).

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import Aviso from '@/components/base/Aviso';
import LockConfigFields, { type LockConfig } from './LockConfigFields';
import EntitlementsEditor from './EntitlementsEditor';

interface Props {
  lock: LockConfig;
  onChange: (patch: Partial<LockConfig>) => void;
  /** Alvo já salvo (pra liberar clientes/e-mails); null na criação. */
  alvo: { tipo: 'course' | 'module'; id: string } | null;
}

export default function AvancadoDoBloqueio({ lock, onChange, alvo }: Props) {
  const [aberto, setAberto] = useState(lock.access === 'restricted');
  return (
    <div>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronRight className={`h-4 w-4 transition-transform ${aberto ? 'rotate-90' : ''}`} />
        Cadeado de venda e liberação por e-mail
      </button>
      {aberto && (
        <div className="mt-3 grid gap-3">
          <LockConfigFields value={lock} onChange={onChange} />
          {lock.access === 'restricted' && (alvo
            ? <EntitlementsEditor targetType={alvo.tipo} targetId={alvo.id} />
            : <Aviso tom="neutro" compacto>Salve primeiro pra liberar clientes ou e-mails específicos.</Aviso>)}
        </div>
      )}
    </div>
  );
}
