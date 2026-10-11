import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/ds';
import EditItemModal from '@/components/pipelines/EditItemModal';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { contactsService } from '@/services/contacts/contactsService';
import {
  atendimentosDoContato,
  itemSemFunil,
  type Atendimento,
} from '@/features/cardDoLead/cardDoLead';
import type { PipelineItem, PipelineStage } from '@/types/analytics';
import { comSituacaoNova } from '@/features/pipelines/situacao/situacao';
import { useTelaDeCelular } from '@/hooks/useMediaQuery';
import { useAbrirPaginaDoCard } from '@/features/cardDoLead/paginaNoCelular';

interface Props {
  contactId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Algo mudou no card (etapa, etiqueta, dono, juntou): a lista recarrega ao fechar. */
  onMudou?: () => void;
  /** Aberto pelo endereço /contacts/:id: no celular, a página do card TROCA esse endereço no histórico. */
  abertoPeloEndereco?: boolean;
}

type Carregado =
  | { tipo: 'atendimentos'; lista: Atendimento[] }
  | { tipo: 'semFunil'; item: PipelineItem };

// O card do lead aberto PELA PESSOA, em Contatos (spec
// 2026-10-02-fase-4-card-do-contato). Substitui a antiga "Detalhes do Contato":
// - está em funil → o card daquele atendimento;
// - em mais de um → abinhas centralizadas no topo, uma por funil (modelo do
//   Kenlo: cliente com vários atendimentos). Raro, por isso só aparecem nele;
// - em nenhum → o mesmo card sem funil, com "Colocar no funil" no lugar da Etapa.
//
// No celular (10/10/2026, features/cardDoLead/paginaNoCelular.ts) o card em funil
// abre na PÁGINA do card completo; em mais de um funil, a pessoa escolhe qual
// antes. O card sem funil continua na janela (a página precisa de um funil).
export default function CardDoContato({ contactId, onOpenChange, onMudou, abertoPeloEndereco = false }: Props) {
  const [carregado, setCarregado] = useState<Carregado | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<string | null>(null);
  const [mudou, setMudou] = useState(false);
  const celular = useTelaDeCelular();
  const abrirPaginaDoCard = useAbrirPaginaDoCard();
  // A chave de quando a tela abriu: a lista de Contatos grava filtros no
  // endereço (replace), e isso troca a chave depois.
  const chaveAoAbrir = useLocation().key;
  const [veioDeDentroDoApp] = useState(() => chaveAoAbrir !== 'default');
  const irParaPagina = (a: Atendimento) =>
    abrirPaginaDoCard(a.pipeline.id, a.item.id, {
      substituir: abertoPeloEndereco,
      voltarPeloHistorico: abertoPeloEndereco ? veioDeDentroDoApp : true,
    });
  const irParaPaginaRef = useRef(irParaPagina);
  irParaPaginaRef.current = irParaPagina;
  const celularRef = useRef(celular);
  celularRef.current = celular;
  // Fechou (ou trocou de contato) antes de carregar: a resposta atrasada não navega.
  const pedidoRef = useRef<string | null>(contactId);
  useEffect(() => {
    pedidoRef.current = contactId;
    return () => { pedidoRef.current = null; };
  }, [contactId]);
  // A busca pode rodar mais de uma vez pro mesmo contato: navega uma vez só.
  const navegouRef = useRef<string | null>(null);

  const carregar = useCallback(async (id: string, focarItemNovo = false) => {
    try {
      const pipelines = await pipelinesService.getPipelinesByContact(id);
      const lista = atendimentosDoContato(pipelines as never);
      if (lista.length === 1 && celularRef.current) {
        if (pedidoRef.current === id && navegouRef.current !== id) {
          navegouRef.current = id;
          irParaPaginaRef.current(lista[0]);
        }
        return;
      }
      if (lista.length > 0) {
        setCarregado({ tipo: 'atendimentos', lista });
        setAbaAtiva(atual => (focarItemNovo || !atual || !lista.some(a => a.item.id === atual) ? lista[0].item.id : atual));
        return;
      }
      // Sem funil: o card sai do próprio contato + a conversa mais recente dele.
      const [contato, conversas] = await Promise.all([
        contactsService.getContact(id),
        contactsService.getContactConversations(id).catch(() => null),
      ]);
      const ultima = (conversas?.data ?? [])[0] as { id?: string | number } | undefined;
      setCarregado({ tipo: 'semFunil', item: itemSemFunil(contato, ultima?.id != null ? String(ultima.id) : null) });
    } catch {
      toast.error('Não consegui abrir o contato.');
      onOpenChange(false);
    }
  }, [onOpenChange]);

  useEffect(() => {
    setCarregado(null);
    setAbaAtiva(null);
    setMudou(false);
    if (contactId) carregar(contactId);
  }, [contactId, carregar]);

  const fechar = (aberto: boolean) => {
    if (aberto) return;
    if (mudou) onMudou?.();
    onOpenChange(false);
  };
  const marcarMudanca = () => setMudou(true);

  if (!contactId) return null;

  if (!carregado) {
    return (
      <Dialog open onOpenChange={fechar}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle className="sr-only">Abrindo o contato</DialogTitle>
          <DialogDescription className="sr-only">Carregando o card do contato</DialogDescription>
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Abrindo o contato…
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const comum = {
    open: true,
    onOpenChange: fechar,
    onLabelsChanged: marcarMudanca,
    onContatoJuntado: () => { setMudou(true); onMudou?.(); },
  };

  if (carregado.tipo === 'semFunil') {
    return (
      <EditItemModal
        {...comum}
        key={`sem-funil-${contactId}`}
        item={carregado.item}
        stages={[]}
        onColocadoNoFunil={() => { setMudou(true); carregar(contactId, true); }}
      />
    );
  }

  // Celular com o lead em mais de um funil: escolhe qual card abrir na página.
  if (celular) {
    return (
      <Dialog open onOpenChange={fechar}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>Abrir o card de qual funil?</DialogTitle>
          <DialogDescription>Este contato está em mais de um funil.</DialogDescription>
          <ul className="space-y-2">
            {carregado.lista.map(a => {
              const etapa = a.stages.find(s => String(s.id) === String(a.item.stage_id));
              return (
                <li key={a.item.id}>
                  <button
                    type="button"
                    onClick={() => irParaPagina(a)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-3 text-left hover:bg-muted"
                  >
                    {etapa && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: etapa.color }} aria-hidden="true" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.pipeline.name}</span>
                      {etapa && <span className="block truncate text-xs text-muted-foreground">{etapa.name}</span>}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    );
  }

  const atual = carregado.lista.find(a => a.item.id === abaAtiva) ?? carregado.lista[0];
  const abas = carregado.lista.length > 1 && (
    <div role="tablist" aria-label="Atendimentos do contato" className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
      {carregado.lista.map(a => {
        const ativa = a.item.id === atual.item.id;
        const etapa = a.stages.find(s => String(s.id) === String(a.item.stage_id));
        return (
          <button
            key={a.item.id}
            type="button"
            role="tab"
            aria-selected={ativa}
            onClick={() => setAbaAtiva(a.item.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              ativa ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {etapa && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: etapa.color }} aria-hidden="true" />}
            {a.pipeline.name}
          </button>
        );
      })}
    </div>
  );

  return (
    <EditItemModal
      {...comum}
      // Trocar de atendimento remonta o card: cada um tem etapa e histórico de carregamento próprios.
      key={atual.item.id}
      item={atual.item}
      stages={atual.stages as unknown as PipelineStage[]}
      cabecalho={abas || undefined}
      onItemStageMoved={(itemId, etapaId) => {
        setMudou(true);
        setCarregado(c =>
          c?.tipo === 'atendimentos'
            ? { ...c, lista: c.lista.map(a => (a.item.id === itemId ? { ...a, item: { ...a.item, stage_id: etapaId } } : a)) }
            : c,
        );
      }}
      // Ganho/Perdido/Reabrir: a lista guarda o card com a situação nova.
      onItemStatusChanged={novo => {
        setMudou(true);
        setCarregado(c =>
          c?.tipo === 'atendimentos'
            ? { ...c, lista: c.lista.map(a => (a.item.id === novo.id ? { ...a, item: comSituacaoNova(a.item, novo) } : a)) }
            : c,
        );
      }}
    />
  );
}
