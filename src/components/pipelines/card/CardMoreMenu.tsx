// Menu "⋯" do topo do card: as ações que não são do dia a dia — copiar o link,
// mandar pra roleta / tirar da roleta e tirar o lead do funil. Remover pede
// confirmação numa janela, nunca no confirm() do navegador.
//
// Roleta nova (06/10/2026): o card só ESCOLHE uma roleta que já existe. O atalho
// "Nova roleta" morreu: sem roleta ligada, o item leva pra página da roleta.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleSlash, Link, Loader2, Merge, MoreHorizontal, Shuffle, Trash2 } from 'lucide-react';
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
import { PAGINA_DA_ROLETA } from '@/components/roleta/textosDaRoleta';
import type { PipelineItem } from '@/types/analytics';
import { contatoDoCard, semFunil } from '@/features/cardDoLead/cardDoLead';

interface CardMoreMenuProps {
  item: PipelineItem;
  /** Só as roletas LIGADAS: é pra onde dá pra mandar o lead agora. */
  roletas: RoletaConfig[];
  trocandoRoleta: boolean;
  onTrocarRoleta: (roletaId: string) => Promise<void> | void;
  /** Há oferta esperando aceite: o menu oferece "Tirar da roleta". */
  onTirarDaRoleta?: () => void;
  onRemovido: () => void;
  /** Gestor: "Juntar com outro contato" (veio da antiga Detalhes do Contato). */
  onJuntar?: () => void;
}

export default function CardMoreMenu({
  item,
  roletas,
  trocandoRoleta,
  onTrocarRoleta,
  onTirarDaRoleta,
  onRemovido,
  onJuntar,
}: CardMoreMenuProps) {
  const navigate = useNavigate();
  // Card de quem não está em funil (aberto de Contatos): o link é o do contato
  // e não há o que remover do funil.
  const foraDoFunil = semFunil(item);
  const contatoId = contatoDoCard(item)?.id;
  const [roletaAberta, setRoletaAberta] = useState(false);
  const [roletaEscolhida, setRoletaEscolhida] = useState('');
  const [removerAberto, setRemoverAberto] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  const copiarLink = () => {
    const url = foraDoFunil
      ? `${window.location.origin}/contacts/${contatoId}`
      : `${window.location.origin}/pipelines/${item.pipeline_id}?card=${item.id}`;
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
          <DropdownMenuItem
            onClick={() => {
              if (roletas.length === 0) { navigate(PAGINA_DA_ROLETA); return; }
              setRoletaEscolhida('');
              setRoletaAberta(true);
            }}
          >
            <Shuffle className="h-3.5 w-3.5 mr-2" />
            Mandar pra roleta
          </DropdownMenuItem>
          {onTirarDaRoleta && (
            <DropdownMenuItem onClick={onTirarDaRoleta}>
              <CircleSlash className="h-3.5 w-3.5 mr-2" />
              Tirar da roleta
            </DropdownMenuItem>
          )}
          {onJuntar && (
            <DropdownMenuItem onClick={onJuntar}>
              <Merge className="h-3.5 w-3.5 mr-2" />
              Juntar com outro contato
            </DropdownMenuItem>
          )}
          {!foraDoFunil && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setRemoverAberto(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Remover do funil
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={roletaAberta} onOpenChange={setRoletaAberta}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>Mandar pra roleta</DialogTitle>
          <DialogDescription>
            A roleta escolhida oferece o lead a um corretor. Ele vira o responsável quando aceitar.
          </DialogDescription>
          <Select value={roletaEscolhida} onValueChange={setRoletaEscolhida}>
            <SelectTrigger className="h-9 text-sm" aria-label="Roleta">
              <SelectValue placeholder="Escolha a roleta" />
            </SelectTrigger>
            <SelectContent>
              {roletas.map(r => (
                <SelectItem key={r.id} value={r.id}>{roletaLabel(r)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRoletaAberta(false)}>Cancelar</Button>
            <Button
              type="button"
              disabled={!roletaEscolhida || trocandoRoleta}
              onClick={async () => { await onTrocarRoleta(roletaEscolhida); setRoletaAberta(false); }}
            >
              {trocandoRoleta && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Mandar pra roleta
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
