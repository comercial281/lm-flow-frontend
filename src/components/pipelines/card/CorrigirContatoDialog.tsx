// Correção de telefone/e-mail pelo gestor, só em lead cadastrado à mão. Quem
// decide se o lápis aparece é o servidor (`identity_correctable`); o servidor
// também confere de novo ao salvar e grava a correção no histórico do card.
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
  telefoneAtual: string;
  emailAtual: string;
  onCorrigido: (dados: { phone_number: string; email: string }) => void;
}

export default function CorrigirContatoDialog({
  open,
  onOpenChange,
  contactId,
  telefoneAtual,
  emailAtual,
  onCorrigido,
}: CorrigirContatoDialogProps) {
  const [telefone, setTelefone] = useState(telefoneAtual);
  const [email, setEmail] = useState(emailAtual);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTelefone(telefoneAtual);
    setEmail(emailAtual);
  }, [open, telefoneAtual, emailAtual]);

  const salvar = async () => {
    const digitos = telefone.replace(/\D/g, '');
    const phone = digitos ? `+${digitos}` : '';
    const mail = email.trim();
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      toast.error('E-mail inválido');
      return;
    }
    const payload: Record<string, string> = {};
    if (phone !== (telefoneAtual || '')) payload.phone_number = phone;
    if (mail !== (emailAtual || '')) payload.email = mail;
    if (Object.keys(payload).length === 0) { onOpenChange(false); return; }

    setSalvando(true);
    try {
      await contactsService.updateContact(contactId, payload);
      toast.success('Contato corrigido');
      onCorrigido({ phone_number: phone, email: mail });
      onOpenChange(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui corrigir o contato'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle>Corrigir contato</DialogTitle>
        <DialogDescription>
          Só para erro de digitação em lead cadastrado à mão. A correção fica no histórico do lead.
        </DialogDescription>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="corrigir-telefone" className="text-xs">Telefone (com DDD)</Label>
            <Input id="corrigir-telefone" value={telefone} onChange={e => setTelefone(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="corrigir-email" className="text-xs">E-mail</Label>
            <Input id="corrigir-email" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={salvando} />
          </div>
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
