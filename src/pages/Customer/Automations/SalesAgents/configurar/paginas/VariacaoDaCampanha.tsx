// A janela "Editar" de UMA variação por campanha (as "recepções por campanha",
// `openings`). Cada campo grava ao sair, regravando a lista inteira com só esta
// variação trocada (o servidor troca `openings` inteiro). "Excluir variação" grava
// na hora e o "Desfazer" do aviso traz de volta.
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Textarea } from '@/components/ui/ds';
import { CampoDaJanela, GradeDaJanela, GrupoDaJanela } from '@/components/base/janela';
import type { SalesAgent, SalesAgentOpening } from '@/services/salesAgents/salesAgentsService';
import { CampoDeMidia } from '../CampoDeMidia';
import { useTextoNaHora } from '../TextoNaHora';
import type { Gravar } from '../useGravarNaHora';

const paraLista = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

// Campo que grava ao sair (o mesmo gancho do TextoNaHora), no campo do miolo da janela.
function CampoNaHora({ id, rotulo, salvo, aoGravar, varias, colunas, ajuda }: {
  id: string; rotulo: string; salvo: string; aoGravar: (texto: string) => unknown;
  varias?: boolean; colunas?: 1 | 2 | 3 | 4; ajuda?: string;
}) {
  const { valor, mudar, aoSair } = useTextoNaHora(salvo, aoGravar);
  return (
    <CampoDaJanela rotulo={rotulo} htmlFor={id} ajuda={ajuda} colunas={colunas}>
      {varias ? (
        <Textarea id={id} className="w-full" rows={2} value={valor} onChange={(e) => mudar(e.target.value)} onBlur={aoSair} />
      ) : (
        <Input id={id} className="w-full" value={valor} onChange={(e) => mudar(e.target.value)} onBlur={aoSair}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
      )}
    </CampoDaJanela>
  );
}

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
        <div className="grid gap-5">
          <GrupoDaJanela titulo="Identificação">
            <GradeDaJanela>
              <CampoNaHora id={id('nome')} colunas={4} rotulo="Nome da variação" salvo={v.label ?? ''} aoGravar={(x) => trocar({ label: x.trim() || 'Sem nome' })} />
            </GradeDaJanela>
          </GrupoDaJanela>
          <GrupoDaJanela titulo="Quando vale">
            <GradeDaJanela>
              <CampoNaHora id={id('origens')} colunas={2} rotulo="Origens" ajuda="Separe por vírgula." salvo={(v.origins ?? []).join(', ')} aoGravar={(x) => trocar({ origins: paraLista(x) })} />
              <CampoNaHora id={id('forms')} colunas={2} rotulo="Formulários do Meta" ajuda="Códigos dos formulários, separados por vírgula." salvo={(v.form_ids ?? []).join(', ')} aoGravar={(x) => trocar({ form_ids: paraLista(x) })} />
              <CampoNaHora id={id('palavras')} colunas={4} rotulo="Palavras na primeira mensagem do lead" ajuda="Separe por vírgula." salvo={(v.keywords ?? []).join(', ')} aoGravar={(x) => trocar({ keywords: paraLista(x) })} />
            </GradeDaJanela>
          </GrupoDaJanela>
          <GrupoDaJanela titulo="O que ela diz">
            <GradeDaJanela>
              <CampoNaHora id={id('texto')} varias colunas={4} rotulo="Texto de base desta campanha" ajuda="Vazio usa o texto padrão." salvo={v.greeting ?? ''} aoGravar={(x) => trocar({ greeting: x.trim() ? x : undefined })} />
              <CampoNaHora id={id('intencao')} varias colunas={4} rotulo="Pergunta de intenção desta campanha" ajuda="Vazio usa a pergunta padrão." salvo={v.intent_question ?? ''} aoGravar={(x) => trocar({ intent_question: x.trim() ? x : undefined })} />
            </GradeDaJanela>
          </GrupoDaJanela>
          <GrupoDaJanela titulo="Mídia">
            <GradeDaJanela>
              <CampoDeMidia naJanela colunas={2} id={id('imagem')} agentId={agent.id} tipo="image" rotulo="Imagem desta campanha" valor={v.image_url} aoMudar={(url) => void trocar({ image_url: url ?? undefined })} />
              <CampoDeMidia naJanela colunas={2} id={id('audio')} agentId={agent.id} tipo="audio" rotulo="Áudio desta campanha" valor={v.audio_url} aoMudar={(url) => void trocar({ audio_url: url ?? undefined })} />
            </GradeDaJanela>
          </GrupoDaJanela>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" className="text-destructive" onClick={excluir}>Excluir variação</Button>
          <Button type="button" onClick={aoFechar}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
