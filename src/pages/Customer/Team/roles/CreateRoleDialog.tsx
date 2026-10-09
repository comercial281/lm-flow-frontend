import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription, Label as UILabel,
} from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
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
        <div className="space-y-3">
          <div>
            <UILabel htmlFor="novo-cargo-nome" className="text-xs">Nome do cargo</UILabel>
            <Input id="novo-cargo-nome" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: SDR" className="mt-1" />
          </div>
          <div>
            <UILabel htmlFor="novo-cargo-base" className="text-xs">Começar igual a</UILabel>
            <Seletor id="novo-cargo-base" value={baseId} onChange={e => setBaseId(e.target.value)} className="mt-1 w-full">
              {bases.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
            </Seletor>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void submit()} disabled={saving || !name.trim() || !baseId}>{saving ? 'Criando...' : 'Criar cargo'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
