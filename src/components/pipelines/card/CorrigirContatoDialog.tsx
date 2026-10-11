// Correção dos dados do lead pelo card. Nome: responsável pelo lead ou gestor
// (11/10/2026). Telefone/e-mail: gestor, só em lead cadastrado à mão. Quem decide
// o que aparece é o servidor (`name_editable`, `identity_correctable`); o servidor
// também confere de novo ao salvar e grava a mudança no histórico do card.
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Input,
  Label,
} from '@/components/ui/ds';
import { contactsService } from '@/services/contacts/contactsService';
import { apiErrorMessage } from '@/utils/apiHelpers';

interface CorrigirContatoDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contactId: string;
  nomeAtual: string;
  /** Mostra o campo Nome (`name_editable`). */
  podeNome: boolean;
  /** Mostra Telefone e E-mail (`identity_correctable`). */
  podeContato: boolean;
  telefoneAtual: string;
  emailAtual: string;
  onCorrigido: (dados: { name: string; phone_number: string; email: string }) => void;
}

const limparNome = (v: string) => v.replace(/\s+/g, ' ').trim();

export default function CorrigirContatoDialog({
  open,
  onOpenChange,
  contactId,
  nomeAtual,
  podeNome,
  podeContato,
  telefoneAtual,
  emailAtual,
  onCorrigido,
}: CorrigirContatoDialogProps) {
  const [nome, setNome] = useState(nomeAtual);
  const [telefone, setTelefone] = useState(telefoneAtual);
  const [email, setEmail] = useState(emailAtual);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(nomeAtual);
    setTelefone(telefoneAtual);
    setEmail(emailAtual);
  }, [open, nomeAtual, telefoneAtual, emailAtual]);

  const salvar = async () => {
    const name = limparNome(nome);
    const digitos = telefone.replace(/\D/g, '');
    const phone = digitos ? `+${digitos}` : '';
    const mail = email.trim();
    if (podeNome && !name) {
      toast.error('Escreva o nome do lead');
      return;
    }
    if (podeContato && mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      toast.error('E-mail inválido');
      return;
    }
    const payload: Record<string, string> = {};
    if (podeNome && name !== limparNome(nomeAtual || '')) payload.name = name;
    if (podeContato && phone !== (telefoneAtual || '')) payload.phone_number = phone;
    if (podeContato && mail !== (emailAtual || '')) payload.email = mail;
    if (Object.keys(payload).length === 0) { onOpenChange(false); return; }

    setSalvando(true);
    try {
      await contactsService.updateContact(contactId, payload);
      toast.success(payload.name && Object.keys(payload).length === 1 ? 'Nome corrigido' : 'Contato corrigido');
      onCorrigido({
        name: payload.name ?? nomeAtual,
        phone_number: payload.phone_number ?? telefoneAtual,
        email: payload.email ?? emailAtual,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui corrigir o contato'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{podeContato ? 'Corrigir contato' : 'Corrigir nome'}</DialogTitle>
        <DialogDescription>
          {podeContato
            ? 'Telefone e e-mail só para erro de digitação em lead cadastrado à mão. A correção fica no histórico do lead.'
            : 'A troca fica no histórico do lead.'}
        </DialogDescription>
        <div className="space-y-3">
          {podeNome && (
            <div className="space-y-1">
              <Label htmlFor="corrigir-nome" className="text-xs">Nome</Label>
              <Input id="corrigir-nome" value={nome} onChange={e => setNome(e.target.value)} disabled={salvando} />
            </div>
          )}
          {podeContato && (
            <>
              <div className="space-y-1">
                <Label htmlFor="corrigir-telefone" className="text-xs">Telefone (com DDD)</Label>
                <Input id="corrigir-telefone" value={telefone} onChange={e => setTelefone(e.target.value)} disabled={salvando} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="corrigir-email" className="text-xs">E-mail</Label>
                <Input id="corrigir-email" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={salvando} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={salvando} onClick={salvar}>
            {salvando && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Salvar correção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
