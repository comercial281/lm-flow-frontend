// A janela "Editar" de UMA variação por campanha (as "recepções por campanha",
// `openings`). Cada campo grava ao sair, regravando a lista inteira com só esta
// variação trocada (o servidor troca `openings` inteiro). "Excluir variação" grava
// na hora e o "Desfazer" do aviso traz de volta.
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/ds';
import type { SalesAgent, SalesAgentOpening } from '@/services/salesAgents/salesAgentsService';
import { CampoDeMidia } from '../CampoDeMidia';
import TextoNaHora from '../TextoNaHora';
import type { Gravar } from '../useGravarNaHora';

const paraLista = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function VariacaoDaCampanha({ agent, indice, gravar, aoFechar }: {
  agent: SalesAgent;
  indice: number;
  gravar: Gravar;
  aoFechar: () => void;
}) {
  const lista = agent.openings ?? [];
  const v = lista[indice];
  if (!v) return null;
  const trocar = (p: Partial<SalesAgentOpening>) => gravar({ openings: lista.map((x, j) => (j === indice ? { ...x, ...p } : x)) });
  const excluir = () => void gravar({ openings: lista.filter((_, j) => j !== indice) }).then((ok) => ok && aoFechar());
  const id = (c: string) => `variacao-${indice}-${c}`;

  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto) aoFechar(); }}>
      <DialogContent size="wide">
        <DialogHeader><DialogTitle>{`Variação: ${v.label || 'sem nome'}`}</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <TextoNaHora id={id('nome')} rotulo="Nome da variação" salvo={v.label ?? ''} aoGravar={(x) => trocar({ label: x.trim() || 'Sem nome' })} />
          <TextoNaHora id={id('origens')} rotulo="Origens (separe por vírgula)" salvo={(v.origins ?? []).join(', ')} aoGravar={(x) => trocar({ origins: paraLista(x) })} />
          <TextoNaHora id={id('forms')} rotulo="Códigos dos formulários do Meta (separe por vírgula)" salvo={(v.form_ids ?? []).join(', ')} aoGravar={(x) => trocar({ form_ids: paraLista(x) })} />
          <TextoNaHora id={id('palavras')} rotulo="Palavras na primeira mensagem do lead (separe por vírgula)" salvo={(v.keywords ?? []).join(', ')} aoGravar={(x) => trocar({ keywords: paraLista(x) })} />
          <TextoNaHora id={id('texto')} tipo="varias" rows={2} rotulo="Texto de base desta campanha" ajuda="Vazio usa o texto padrão." salvo={v.greeting ?? ''} aoGravar={(x) => trocar({ greeting: x.trim() ? x : undefined })} />
          <TextoNaHora id={id('intencao')} tipo="varias" rows={2} rotulo="Pergunta de intenção desta campanha" ajuda="Vazio usa a pergunta padrão." salvo={v.intent_question ?? ''} aoGravar={(x) => trocar({ intent_question: x.trim() ? x : undefined })} />
          <CampoDeMidia id={id('imagem')} agentId={agent.id} tipo="image" rotulo="Imagem desta campanha" valor={v.image_url} aoMudar={(url) => void trocar({ image_url: url ?? undefined })} />
          <CampoDeMidia id={id('audio')} agentId={agent.id} tipo="audio" rotulo="Áudio desta campanha" valor={v.audio_url} aoMudar={(url) => void trocar({ audio_url: url ?? undefined })} />
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" className="text-destructive" onClick={excluir}>Excluir variação</Button>
          <Button type="button" onClick={aoFechar}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
