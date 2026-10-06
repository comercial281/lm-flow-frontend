// Passo 8 · Testar e ligar. O resumo de tudo, por passo, com "Editar"; o que falta,
// com "Corrigir"; e o Ligar — a única CHAVE do passo a passo (efeito na hora).
//
// Ligar fica travado sem número e na persona do próprio corretor num número sem
// dono (podeLigar). Desligar nunca trava. O servidor recusa o mesmo caso; a frase
// dele aparece na chave.
//
// O Testar fiel (mesmo caminho do atendimento real) é a entrega 3; aqui é o atalho
// pra tela Testar.
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/ds';
import Chave from '@/components/base/Chave';
import { Secao } from '@/components/base/Secao';
import { salesAgentsService } from '@/services/salesAgents/salesAgentsService';
import { isForbiddenError } from '@/services/core/forbidden';
import { motivoEscrito } from '@/features/salesAgents/erroDoServidor';
import { pendenciasDosPassos, podeLigar } from '@/features/salesAgents/pendencias';
import { resumoDosPassos } from '@/features/salesAgents/resumoDosPassos';
import { CascaDoPasso } from '../pecas';
import { ListaDePendencias } from '../ListaDePendencias';
import { PASSOS, type NumeroDoPasso, type PropsDoPasso } from '../passos';

export default function Passo8TestarLigar({ agent, inboxes, aoSalvo, irParaPasso }: PropsDoPasso) {
  const [, setParams] = useSearchParams();
  const pendencias = pendenciasDosPassos(agent);
  const { pode, motivo } = podeLigar(agent);
  const numero = inboxes.find((i) => String(i.id) === String(agent.inbox_id ?? ''))?.name ?? null;
  const linhas = resumoDosPassos(agent, { numero });

  const abrirTestar = () => setParams((p) => {
    const n = new URLSearchParams(p);
    n.set('tela', 'testar');
    n.delete('passo');
    return n;
  });

  // A Chave lê `response.data.message`; a recusa do modelo vem em `error.message`.
  const ligar = async (v: boolean) => {
    try {
      aoSalvo(await salesAgentsService.update(agent.id, { enabled: v }));
    } catch (e) {
      if (isForbiddenError(e)) throw e;
      throw { response: { data: { message: motivoEscrito(e) ?? undefined } } };
    }
  };

  return (
    <CascaDoPasso numero={8} pendente={false} salvando={false} erro={null} aoSalvar={() => {}} aoDescartar={() => {}}>
      <Secao titulo="Testar" descricao="Converse com ela como se fosse um lead, sem mandar nada no WhatsApp.">
        <Button type="button" variant="outline" onClick={abrirTestar}>Abrir o Testar</Button>
      </Secao>

      <Secao titulo="Resumo" descricao="Como ela está configurada, passo por passo.">
        <ul className="space-y-2">
          {linhas.map(({ passo, linha }) => {
            const titulo = PASSOS.find((p) => p.numero === passo)!.titulo;
            return (
              <li key={passo} className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{titulo}</p>
                  <p className="text-sm text-muted-foreground">{linha}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" aria-label={`Editar ${titulo}`}
                  onClick={() => irParaPasso(passo as NumeroDoPasso)}>Editar</Button>
              </li>
            );
          })}
        </ul>
      </Secao>

      {pendencias.length > 0 && (
        <Secao titulo="O que falta" descricao="Em vermelho, o que impede ligar.">
          <ListaDePendencias pendencias={pendencias} aoCorrigir={irParaPasso} />
        </Secao>
      )}

      <Secao titulo="Ligar" descricao="Ligada, ela começa a responder os leads do número na hora.">
        <Chave rotulo="IA ligada" genero="a" ligada={agent.enabled} desabilitada={!agent.enabled && !pode} aoMudar={ligar} />
        {!agent.enabled && !pode && motivo && <p className="text-sm text-red-700 dark:text-red-400">{motivo}</p>}
      </Secao>
    </CascaDoPasso>
  );
}
