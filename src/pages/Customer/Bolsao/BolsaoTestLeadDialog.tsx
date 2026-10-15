import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/components/ui/ds';
import { FlaskConical, Loader2, Wand2 } from 'lucide-react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import bolsaoService from '@/services/bolsao/bolsaoService';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneInput } from '@/components/shared/PhoneInput';
import Aviso from '@/components/base/Aviso';
import { CampoDaJanela, GradeDaJanela, GrupoDaJanela } from '@/components/base/janela';

const SAMPLE = {
  name: 'Lead de Teste',
  city: 'Indaiatuba',
  interest: 'Apartamento 2 dormitórios',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function BolsaoTestLeadDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ phone_number: '', name: '', city: '', interest: '' });

  // O telefone já vem sugerido como o do próprio gestor: o teste só serve se a
  // mensagem chegar em alguém que está esperando por ela.
  useEffect(() => {
    if (!open) return;
    const own = (user as { phone_number?: string } | null)?.phone_number ?? '';
    setForm({ phone_number: own, name: '', city: '', interest: '' });
  }, [open, user]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await bolsaoService.createTestLead({
        phone_number: form.phone_number,
        name: form.name || undefined,
        city: form.city || undefined,
        interest: form.interest || undefined,
      });
      toast.success('Lead de teste criado. Ele aparece no Bolsão com o selo TESTE.');
      onCreated();
      onOpenChange(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui criar o lead de teste.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => (saving ? null : onOpenChange(v))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" /> Criar lead de teste
          </DialogTitle>
          <DialogDescription>
            Para conferir o Bolsão sem depender de planilha. Ele aparece na lista com o selo TESTE e
            fica fora dos relatórios.
          </DialogDescription>
        </DialogHeader>

        <GrupoDaJanela titulo="Dados do lead">
          <GradeDaJanela>
            <CampoDaJanela rotulo="Telefone com DDD" htmlFor="test-phone" obrigatorio colunas={4}>
              <PhoneInput
                id="test-phone"
                placeholder="(11) 98888-7777"
                value={form.phone_number}
                onChange={phone_number => setForm(f => ({ ...f, phone_number }))}
              />
              {/* Número inventado é o número de alguém de verdade — o teste terminaria
                  com um estranho recebendo mensagem de corretor. */}
              <Aviso tom="atencao" compacto>
                Use o <strong>seu</strong> número. Quem puxar esse lead vai mandar mensagem para ele de
                verdade.
              </Aviso>
            </CampoDaJanela>
            <CampoDaJanela rotulo="Nome" htmlFor="test-name" colunas={2}>
              <Input
                id="test-name"
                placeholder={SAMPLE.name}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </CampoDaJanela>
            <CampoDaJanela rotulo="Cidade" htmlFor="test-city" colunas={2}>
              <Input
                id="test-city"
                placeholder={SAMPLE.city}
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              />
            </CampoDaJanela>
            <CampoDaJanela rotulo="Interesse" htmlFor="test-interest" colunas={4}>
              <Input
                id="test-interest"
                placeholder={SAMPLE.interest}
                value={form.interest}
                onChange={e => setForm(f => ({ ...f, interest: e.target.value }))}
              />
            </CampoDaJanela>
          </GradeDaJanela>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setForm(f => ({ ...f, ...SAMPLE }))}
            >
              <Wand2 className="h-4 w-4 mr-2" /> Preencher com exemplo
            </Button>
          </div>
        </GrupoDaJanela>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={saving || !form.phone_number.trim()}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Criar lead de teste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
