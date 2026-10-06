import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { clientesService, type AcaoDoCliente } from '@/services/superAdmin/clientesService';
import type { ClientePooled } from '@/types/admin/clientes';
import ConfirmarDigitando from '../ConfirmarDigitando';
import { pedidoArquivar, pedidoCongelar, pedidoDesarquivar, pedidoDescongelar } from '../confirmacoes';

// Menu ⋯ da página do cliente: congelar, arquivar e excluir, sempre com
// confirmação dizendo o efeito.
export default function MenuDoCliente({ cliente: t, recarregar }: { cliente: ClientePooled; recarregar: () => void }) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [excluindo, setExcluindo] = useState(false);
  const navigate = useNavigate();
  const congelado = t.situation === 'congelado' || t.status === 'suspended';
  const arquivado = t.situation === 'arquivado' || t.archived === true;

  const executar = async (acao: AcaoDoCliente, pedido: Parameters<typeof confirmar>[0]) => {
    if (!(await confirmar(pedido))) return;
    try { await clientesService.acao(t.id, acao); recarregar(); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'Não deu pra fazer isso agora.'); }
  };

  const excluir = async () => {
    try {
      await clientesService.excluir(t.id, t.slug);
      toast.success(`${t.name} foi excluído.`);
      navigate('/admin/clientes');
    } catch (e: any) {
      if (e?.response?.status === 409) {
        toast.error(e.response.data?.error || 'O cliente foi paralisado mas não apagado. Ele está em Arquivados.', { duration: 8000 });
        navigate('/admin/clientes?filtro=arquivados');
        return;
      }
      toast.error(e?.response?.data?.error || 'Não deu pra excluir.');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Mais ações"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!arquivado && (congelado
            ? <DropdownMenuItem onSelect={() => void executar('unsuspend', pedidoDescongelar(t))}>Descongelar</DropdownMenuItem>
            : <DropdownMenuItem onSelect={() => void executar('suspend', pedidoCongelar(t))}>Congelar</DropdownMenuItem>)}
          {arquivado
            ? <DropdownMenuItem onSelect={() => void executar('unarchive', pedidoDesarquivar(t))}>Desarquivar</DropdownMenuItem>
            : <DropdownMenuItem onSelect={() => void executar('archive', pedidoArquivar(t))}>Arquivar</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600 dark:text-red-400" onSelect={() => setExcluindo(true)}>Excluir</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmarDigitando aberto={excluindo} titulo={`Excluir ${t.name}?`}
        descricao="Apaga o cliente e todos os dados dele. Não tem volta." esperado={t.slug} rotuloDaAcao="Excluir"
        aoConfirmar={excluir} aoFechar={() => setExcluindo(false)} />
      {dialogoDeConfirmacao}
    </>
  );
}
