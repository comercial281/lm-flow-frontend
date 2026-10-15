import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { CampoDaJanela, GrupoDaJanela } from '@/components/base/janela';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { customRolesService } from '@/services/customRoles/customRolesService';
import type { RoleCapabilities } from '@/types/customRoles';

/* "Criar cargo personalizado": nome + "Começar igual a". O cargo novo nasce como
   cópia de um cargo de fábrica (o servidor copia permissões e herança) e as
   mudanças finas vão depois, na aba Permissões. Nada de editor em branco. */

interface Props {
  open: boolean;
  /** Cargos de fábrica que quem está na tela pode usar de base (Gerente só para administrador). */
  bases: RoleCapabilities[];
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateRoleDialog({ open, bases, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [baseId, setBaseId] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  // Padrão: Corretor (o mais comum de personalizar); senão o primeiro disponível.
  useEffect(() => {
    if (!open) return;
    setName('');
    setBaseId(String((bases.find(b => b.slug === 'corretor') ?? bases[0])?.id ?? ''));
  }, [open, bases]);

  const submit = async () => {
    const nome = name.trim();
    if (busy.current || !nome || !baseId) return;
    busy.current = true;
    setSaving(true);
    try {
      await customRolesService.clone(baseId, nome);
      toast.success('Cargo criado.');
      onCreated();
      onClose();
    } catch (e) {
      const erros = (e as { response?: { data?: { errors?: unknown } } })?.response?.data?.errors;
      toast.error(Array.isArray(erros) && erros.length ? erros.join(' ') : apiErrorMessage(e, 'Não consegui criar o cargo. Tente de novo.'));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar cargo personalizado</DialogTitle>
          <DialogDescription>O cargo novo começa com as permissões do cargo escolhido. Depois você ajusta na aba Permissões.</DialogDescription>
        </DialogHeader>
        <GrupoDaJanela titulo="Cargo novo">
          <CampoDaJanela rotulo="Nome do cargo" htmlFor="novo-cargo-nome" obrigatorio>
            <Input id="novo-cargo-nome" value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Pré-vendas" />
          </CampoDaJanela>
          <CampoDaJanela rotulo="Começar igual a" htmlFor="novo-cargo-base">
            <Seletor id="novo-cargo-base" value={baseId} onChange={e => setBaseId(e.target.value)} className="w-full">
              {bases.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
            </Seletor>
          </CampoDaJanela>
        </GrupoDaJanela>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void submit()} disabled={saving || !name.trim() || !baseId}>{saving ? 'Criando...' : 'Criar cargo'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
