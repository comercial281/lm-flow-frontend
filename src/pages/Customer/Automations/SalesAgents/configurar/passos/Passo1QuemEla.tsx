// Passo 1 · Quem ela é. Persona, nome que o lead vê, nome interno e curtidas.
//
// ⚠️ Trocar a persona mexe no DESTINO: o próprio corretor só passa pro dono do
// número (o servidor recusa outra coisa), e sair dele com o lead indo pro dono do
// número volta pra roleta do número (roleta ou corretor escolhidos ficam).
// Por isso os campos do destino também são deste passo (camposDosPassos.ts).
//
// ⚠️ Tom e emoji NÃO aparecem nesta entrega (decisão do índice, 05/10): o roteiro de
// hoje tem "não use emoji" fixo e a opção não faria nada. As colunas `tone` e
// `emoji_use` já existem; os controles entram aqui na entrega 4, e a prévia já
// aceita os dois (`previaConversa`).
//
// O nome que o lead vê é obrigatório pra LIGAR (pendencias.ts), não pra salvar.
import { useMemo } from 'react';
import { Input } from '@/components/ui/ds';
import { Secao } from '@/components/base/Secao';
import { Campo, CampoTexto, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { useAppDataStore } from '@/store/appDataStore';
import type { PersonaDaIa } from '@/services/salesAgents/salesAgentsService';
import { escolhasParaPatch, lerEscolhas } from '@/features/salesAgents/tresEscolhas';
import { previaConversa } from '@/features/salesAgents/previaConversa';
import { FRASE_SEM_DONO } from '@/features/salesAgents/pendencias';
import { PERSONA_ROTULOS } from '@/features/salesAgents/rotulosDaIa';
import { cn } from '@/lib/utils';
import { useRascunho } from '../useRascunho';
import { CAMPOS_DO_PASSO } from '../camposDosPassos';
import { Aviso, Caixa, CascaDoPasso, Escolha, type OpcaoDeEscolha } from '../pecas';
import { BolhasDaPrevia } from '../BolhasDaPrevia';
import { REACOES_POSSIVEIS } from '../opcoes';
import type { PropsDoPasso } from '../passos';

const PERSONAS: OpcaoDeEscolha<PersonaDaIa>[] = [
  { valor: 'broker', titulo: PERSONA_ROTULOS.broker, descricao: 'Fala em primeira pessoa como o dono deste número. Na hora de passar, diz que ela mesma vai ver e retornar, e avisa o dono.' },
  { valor: 'owner', titulo: PERSONA_ROTULOS.owner, descricao: 'Fala como o dono ("aqui é o Carlos, da Aurora") e passa dizendo que um corretor dele vai chamar.' },
  { valor: 'assistant', titulo: PERSONA_ROTULOS.assistant, descricao: 'Fala em nome da imobiliária. Se perguntarem, diz que é assistente virtual e oferece uma pessoa.' },
];

export default function Passo1QuemEla({ agent, aoSalvo }: PropsDoPasso) {
  const { rascunho, mudar, pendente, salvando, erro, salvar, descartar } = useRascunho(agent, CAMPOS_DO_PASSO[1], aoSalvo);
  const imobiliaria = useAppDataStore((s) => s.account)?.name ?? '';
  const escolhas = lerEscolhas(rascunho);
  const persona = escolhas.persona;
  const nomeVisivel = rascunho.lead_facing_name ?? '';
  const semDono = persona === 'broker' && !!rascunho.inbox_id && !rascunho.number_owner_id;
  const virouCorretor = persona === 'broker' && lerEscolhas(agent).persona !== 'broker';
  const reacoes = rascunho.reaction_emojis ?? [];

  const previa = useMemo(
    () => previaConversa({ persona, nome: nomeVisivel, imobiliaria }),
    [persona, nomeVisivel, imobiliaria],
  );

  // ⚠️ Calcula sobre o SALVO, não sobre o rascunho: ir e voltar (corretor → dono →
  // corretor) não pode apagar calado o corretor fixo de uma IA antiga. Voltar pra
  // persona salva devolve tudo como estava.
  const trocarPersona = (p: PersonaDaIa) => {
    if (p === persona) return;
    const salvo = lerEscolhas(agent);
    if (p === salvo.persona) {
      mudar({
        persona_kind: agent.persona_kind, transfer_config: agent.transfer_config, handoff_target: agent.handoff_target,
        handoff_roleta_config_id: agent.handoff_roleta_config_id, handoff_user_id: agent.handoff_user_id,
      });
      return;
    }
    mudar(escolhasParaPatch({ ...salvo, alcance: escolhas.alcance, persona: p }, agent));
  };

  const alternarReacao = (e: string) =>
    mudar({ reaction_emojis: reacoes.includes(e) ? reacoes.filter((x) => x !== e) : [...reacoes, e] });

  return (
    <CascaDoPasso numero={1} previa={<BolhasDaPrevia mensagens={previa} />} pendente={pendente} salvando={salvando}
      erro={erro} aoSalvar={() => void salvar()} aoDescartar={descartar}>
      <Secao titulo="Quem ela é" descricao="A persona muda como ela se apresenta e pra quem o lead vai.">
        <Escolha nome="persona" legenda="Quem ela é" valor={persona} opcoes={PERSONAS} aoEscolher={trocarPersona} />
        {semDono && <Aviso tom="vermelho">{FRASE_SEM_DONO}</Aviso>}
        {virouCorretor && (
          <Aviso tom="neutro">
            O lead passa a ir sempre pro dono do número{rascunho.number_owner_name ? ` (${rascunho.number_owner_name})` : ''}.
          </Aviso>
        )}
      </Secao>

      <Secao titulo="Como ela se apresenta" descricao="O nome que ela diz pro lead. O nome da IA aqui no LM Flow é outro campo.">
        <CampoTexto id="p1-nome-visivel" rotulo="Nome que o lead vê" valor={nomeVisivel} maxLength={60}
          aoMudar={(v) => mudar({ lead_facing_name: v.trim() ? v : null })}
          placeholder={persona === 'broker' ? rascunho.number_owner_name ?? 'Bruno' : 'Bia'}
          ajuda={persona === 'broker' ? 'Na persona do próprio corretor, use o nome do dono do número.' : 'É como ela se apresenta na conversa.'}
          aviso={nomeVisivel.trim() ? undefined : 'Sem ele, a IA não liga.'} />
        <CampoTexto id="p1-nome-interno" rotulo="Nome desta IA no LM Flow" valor={rascunho.name}
          aoMudar={(v) => mudar({ name: v })} ajuda="Só a sua equipe vê. Ajuda a separar uma IA da outra." />
        <Campo id="p1-imobiliaria" rotulo="Imobiliária" ajuda="Vem do cadastro da conta.">
          <Input id="p1-imobiliaria" value={imobiliaria} readOnly className={CLASSE_DO_CAMPO} />
        </Campo>
      </Secao>

      <Secao titulo="Curtidas" descricao="A reação com emoji que aparece grudada na mensagem do lead, no WhatsApp dele.">
        <Caixa id="p1-curtir" rotulo="Curtir mensagens do lead" marcada={!!rascunho.reaction_enabled}
          aoMudar={(v) => mudar({ reaction_enabled: v })} />
        {rascunho.reaction_enabled && (
          <>
            <div role="group" aria-label="Emojis que ela pode usar" className="flex flex-wrap gap-2">
              {REACOES_POSSIVEIS.map((e) => (
                <button key={e} type="button" aria-pressed={reacoes.includes(e)} aria-label={`Usar ${e}`}
                  onClick={() => alternarReacao(e)}
                  className={cn('h-10 w-10 rounded-md border text-lg', reacoes.includes(e) ? 'border-primary bg-primary/10' : 'border-border')}>
                  {e}
                </button>
              ))}
            </div>
            <CampoTexto id="p1-curtidas-max" type="number" min={0} rotulo="No máximo quantas curtidas por conversa"
              valor={String(rascunho.reaction_max_per_conversation ?? 3)}
              aoMudar={(v) => mudar({ reaction_max_per_conversation: Math.max(0, Number(v) || 0) })} />
          </>
        )}
      </Secao>
    </CascaDoPasso>
  );
}
