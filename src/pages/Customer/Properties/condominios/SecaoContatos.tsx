// Contatos do condomínio (zelador, portaria, síndico...): só a imobiliária vê.
import { Trash2 } from 'lucide-react';
import { Button, Input } from '@/components/ui/ds';
import { EmptyState, IconActionButton } from '@/components/base';
import { Seletor } from '@/components/base/Seletor';
import type { CondominiumContact } from '@/services/condominiums/condominiumsService';
import { CONTATO_VAZIO, ROTULO_DO_CARGO } from '@/features/properties/condominios/regrasDoCondominio';

const CARGOS = Object.entries(ROTULO_DO_CARGO) as [CondominiumContact['role'], string][];

export default function SecaoContatos({ contatos, aoMudar, somenteLeitura }: {
  contatos: CondominiumContact[];
  aoMudar: (contatos: CondominiumContact[]) => void;
  somenteLeitura: boolean;
}) {
  const mudar = (i: number, patch: Partial<CondominiumContact>) =>
    aoMudar(contatos.map((c, x) => (x === i ? { ...c, ...patch } : c)));

  return (
    <div className="mt-4 flex flex-col gap-3">
      {contatos.length === 0 ? (
        <EmptyState tamanho="compacto" title="Nenhum contato ainda" />
      ) : (
        <ul className="flex flex-col gap-3">
          {contatos.map((c, i) => (
            <li key={i} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
              <Input aria-label="Nome do contato" placeholder="Nome" value={c.name} disabled={somenteLeitura}
                onChange={e => mudar(i, { name: e.target.value })} />
              <Seletor aria-label="Cargo do contato" value={c.role} disabled={somenteLeitura}
                onChange={e => mudar(i, { role: e.target.value as CondominiumContact['role'] })}>
                {CARGOS.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
              </Seletor>
              <Input aria-label="Telefone do contato" placeholder="Telefone" inputMode="tel" value={c.phone} disabled={somenteLeitura}
                onChange={e => mudar(i, { phone: e.target.value })} />
              <Input aria-label="E-mail do contato" placeholder="E-mail" type="email" value={c.email} disabled={somenteLeitura}
                onChange={e => mudar(i, { email: e.target.value })} />
              {!somenteLeitura && (
                <IconActionButton
                  label={`Remover contato ${c.name.trim() || i + 1}`}
                  icon={<Trash2 className="h-4 w-4" />}
                  variant="ghost"
                  onClick={() => aoMudar(contatos.filter((_, x) => x !== i))}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {!somenteLeitura && (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => aoMudar([...contatos, { ...CONTATO_VAZIO }])}>
            + Adicionar contato
          </Button>
        </div>
      )}
    </div>
  );
}
