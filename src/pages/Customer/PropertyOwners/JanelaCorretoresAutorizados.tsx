import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Label } from '@/components/ui/ds';
import usersService from '@/services/users/usersService';
import { propertyOwnersService, type Pessoa, type ProprietarioCompleto } from '@/services/propertyOwners/propertyOwnersService';

function Linha({ pessoa, marcado, travado, aoAlternar }: {
  pessoa: Pessoa; marcado: boolean; travado: boolean; aoAlternar: () => void;
}) {
  const id = useId();
  return (
    <li className="flex items-center gap-2 py-1.5">
      <Checkbox id={id} checked={marcado} disabled={travado} onCheckedChange={aoAlternar} />
      <Label htmlFor={id} className="font-normal">{pessoa.name}</Label>
      {travado && <span className="text-xs text-muted-foreground">captou</span>}
    </li>
  );
}

/**
 * Quem, além de quem captou, enxerga este proprietário e os imóveis dele.
 * O captador sempre vê: aparece marcado e travado.
 */
export default function JanelaCorretoresAutorizados({ aberta, proprietario, aoFechar, aoSalvar }: {
  aberta: boolean;
  proprietario: Pick<ProprietarioCompleto, 'id' | 'captor' | 'authorized_users'>;
  aoFechar: () => void;
  aoSalvar: (salvo: ProprietarioCompleto) => void;
}) {
  const [usuarios, setUsuarios] = useState<Pessoa[]>([]);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [erro, setErro] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const captorId = proprietario.captor?.id;

  useEffect(() => {
    if (!aberta) return;
    setEscolhidos(proprietario.authorized_users.map(u => u.id).filter(id => id !== captorId));
    setErro(false);
    let vivo = true;
    usersService.getUsers({ per_page: 200, sort: 'name', order: 'asc' })
      .then(r => { if (vivo) setUsuarios((r.data ?? []).map(u => ({ id: u.id, name: u.name }))); })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [aberta, proprietario.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const alternar = (id: string) =>
    setEscolhidos(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id]));

  const salvar = async () => {
    setSalvando(true);
    try {
      aoSalvar(await propertyOwnersService.update(proprietario.id, { authorized_user_ids: escolhidos }));
    } catch {
      toast.error('Não foi possível salvar os corretores');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberta} onOpenChange={o => { if (!o) aoFechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corretores autorizados</DialogTitle>
          <DialogDescription>Quem marcar vê este proprietário e os dados internos dos imóveis dele.</DialogDescription>
        </DialogHeader>
        {erro ? (
          <p role="alert" className="text-sm text-destructive">Não deu para carregar os corretores.</p>
        ) : (
          <ul className="max-h-72 divide-y overflow-y-auto">
            {usuarios.map(u => (
              <Linha key={u.id} pessoa={u} travado={u.id === captorId}
                marcado={u.id === captorId || escolhidos.includes(u.id)} aoAlternar={() => alternar(u.id)} />
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={salvando || erro}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
