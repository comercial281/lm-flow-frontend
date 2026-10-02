// Menu "⋯" do topo do card: as ações que não são do dia a dia — copiar o link,
// trocar de roleta e tirar o lead do funil. Remover pede confirmação numa janela,
// nunca no confirm() do navegador.
import { useState } from 'react';
import { Link, Loader2, MoreHorizontal, Shuffle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ds';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { roletaLabel, type RoletaConfig } from '@/services/roletaConfig/roletaConfigService';
import type { PipelineItem } from '@/types/analytics';

interface CardMoreMenuProps {
  item: PipelineItem;
  roletas: RoletaConfig[];
  trocandoRoleta: boolean;
  onTrocarRoleta: (roletaId: string) => Promise<void> | void;
  onCriarRoleta: () => void;
  onRemovido: () => void;
}

export default function CardMoreMenu({
  item,
  roletas,
  trocandoRoleta,
  onTrocarRoleta,
  onCriarRoleta,
  onRemovido,
}: CardMoreMenuProps) {
  const [roletaAberta, setRoletaAberta] = useState(false);
  const [roletaEscolhida, setRoletaEscolhida] = useState('');
  const [removerAberto, setRemoverAberto] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  const copiarLink = () => {
    const url = `${window.location.origin}/pipelines/${item.pipeline_id}?card=${item.id}`;
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Link do card copiado'))
      .catch(() => toast.error('Não consegui copiar o link'));
  };

  const remover = async () => {
    setRemovendo(true);
    try {
      await pipelinesService.removeItemFromPipeline(item.pipeline_id, item.id);
      toast.success('Lead removido do funil');
      setRemoverAberto(false);
      onRemovido();
    } catch {
      toast.error('Erro ao remover o lead do funil');
    } finally {
      setRemovendo(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Mais ações do card" title="Mais ações">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={copiarLink}>
            <Link className="h-3.5 w-3.5 mr-2" />
            Copiar link do card
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setRoletaEscolhida(''); setRoletaAberta(true); }}>
            <Shuffle className="h-3.5 w-3.5 mr-2" />
            Trocar roleta
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setRemoverAberto(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Remover do funil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={roletaAberta} onOpenChange={setRoletaAberta}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>Trocar roleta</DialogTitle>
          <DialogDescription>
            O lead entra no sorteio da roleta escolhida e vai para quem ela sortear.
          </DialogDescription>
          {roletas.length === 0 ? (
            <Button type="button" variant="outline" onClick={() => { setRoletaAberta(false); onCriarRoleta(); }}>
              Nenhuma roleta ativa — criar uma
            </Button>
          ) : (
            <Select value={roletaEscolhida} onValueChange={setRoletaEscolhida}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Escolha a roleta" />
              </SelectTrigger>
              <SelectContent>
                {roletas.map(r => (
                  <SelectItem key={r.id} value={r.id}>{roletaLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRoletaAberta(false)}>Cancelar</Button>
            <Button
              type="button"
              disabled={!roletaEscolhida || trocandoRoleta}
              onClick={async () => { await onTrocarRoleta(roletaEscolhida); setRoletaAberta(false); }}
            >
              {trocandoRoleta && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Sortear por esta roleta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removerAberto} onOpenChange={setRemoverAberto}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>Remover do funil?</DialogTitle>
          <DialogDescription>
            O lead sai deste funil. A conversa e o contato continuam existindo.
          </DialogDescription>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRemoverAberto(false)}>Cancelar</Button>
            <Button type="button" variant="destructive" disabled={removendo} onClick={remover}>
              {removendo && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Remover do funil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
