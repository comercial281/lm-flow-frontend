import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { copyText } from '@/utils/clipboard';
import { usersService } from '@/services/superAdmin/usersService';
import type { UserRow } from '@/types/admin/users';

// Copiar não pede confirmação (não manda nada pra ninguém). Enviar manda WhatsApp: pede.
// Mensagens iguais às do PooledClients. Sem tenant_id (principal) não há link: sem ações.
export default function AcoesDeAcesso({ row }: { row: UserRow }) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [ocupado, setOcupado] = useState(false);
  if (!row.tenant_id) return null;
  const tenantId = row.tenant_id;
  const quem = row.email ?? row.name;

  const copiar = async () => {
    setOcupado(true);
    try {
      const url = await usersService.copyAccessLink(tenantId, row.user_id);
      if (!url) { toast.error('Não veio o link. Tente de novo.'); return; }
      if (await copyText(url)) toast.success(`Link de acesso de ${quem} copiado. Vale uma vez, por 24 horas.`);
      else toast.message('Copie o link de acesso:', { description: url });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Falha ao gerar o link.');
    } finally {
      setOcupado(false);
    }
  };

  const enviar = async () => {
    const ok = await confirmar({
      titulo: 'Enviar link de acesso?',
      descricao: `Vai pelo WhatsApp de ${row.name}. O link vale uma vez, por 24 horas.`,
      rotuloDaAcao: 'Enviar',
    });
    if (!ok) return;
    setOcupado(true);
    try {
      const wa = await usersService.sendAccessLink(tenantId, row.user_id);
      if (wa.sent) toast.success(`Link enviado no WhatsApp de ${quem}${wa.instance ? ` (${wa.instance})` : ''}.`);
      else toast.error(`Não enviou: ${wa.error ?? wa.skipped ?? 'motivo desconhecido'}`);
    } catch (e: any) {
      const skipped = e?.response?.data?.whatsapp?.skipped;
      toast.error(skipped === 'sem telefone'
        ? 'Esta pessoa não tem WhatsApp no cadastro. Use Copiar link de acesso.'
        : (e?.response?.data?.error || 'Falha ao enviar o link.'));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" disabled={ocupado} onClick={() => void copiar()}>Copiar link</Button>
      <Button variant="outline" size="sm" disabled={ocupado} onClick={() => void enviar()}>Enviar link</Button>
      {dialogoDeConfirmacao}
    </div>
  );
}
