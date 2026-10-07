// Introdução · Identidade (onda 3). Persona em 3 cartões, nome que o lead vê, nome
// interno e o balão de prévia. Decisão do dono do produto (06/10): o corretor fala em
// primeira pessoa e nunca fala de time; o dono fala em primeira pessoa e pode falar do
// time dele; a consultora é o pré-atendimento de quem não tem CRECI.
//
// ⚠️ Trocar a persona mexe no DESTINO (personaParaPatch): o corretor só passa pro
// dono do número, e sair dele vai pra roleta do número.
import { useEffect, useRef } from 'react';
import { Secao, Secoes } from '@/components/base/Secao';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import { useAppDataStore } from '@/store/appDataStore';
import { roletaConfigService, type RoletaConfig } from '@/services/roletaConfig/roletaConfigService';
import type { PersonaGravavel } from '@/services/salesAgents/salesAgentsService';
import { lerEscolhas, personaParaPatch, roletaDoNumero } from '@/features/salesAgents/tresEscolhas';
import { previaConversa } from '@/features/salesAgents/previaConversa';
import { FRASE_SEM_DONO } from '@/features/salesAgents/pendencias';
import { PERSONA_ROTULOS } from '@/features/salesAgents/rotulosDaIa';
import TextoNaHora from '../TextoNaHora';
import { Aviso } from '../Aviso';
import type { PropsDaPagina } from '../paginas';

const PERSONAS = [
  { valor: 'broker' as const, rotulo: PERSONA_ROTULOS.broker, descricao: 'Fala em primeira pessoa como o corretor dono do número. Não fala de equipe: o lead fica com ele.' },
  { valor: 'owner' as const, rotulo: PERSONA_ROTULOS.owner, descricao: 'Fala em primeira pessoa como o dono. Pode dizer que vai ver com o time ou pedir pra um corretor chamar.' },
  { valor: 'assistant' as const, rotulo: PERSONA_ROTULOS.assistant, descricao: 'Pré-atendimento de quem não é corretor. Fala em nome da imobiliária e diz que um corretor vai chamar.' },
];

export default function Identidade({ agent, gravar }: PropsDaPagina) {
  const imobiliaria = useAppDataStore((s) => s.account)?.name ?? '';
  const persona: PersonaGravavel = lerEscolhas(agent).persona;
  // Leitura de fundo: cargo sem acesso a roletas só não acha a roleta do número.
  // ⚠️ Guarda a PROMESSA, não só a lista: a persona escolhida antes de a lista chegar
  // espera por ela. Sem isso, sair de "O corretor" gravava a roleta vazia mesmo com
  // roleta no número (revisão final da onda 3, M3).
  const roletas = useRef<Promise<RoletaConfig[]>>(Promise.resolve([]));
  useEffect(() => {
    roletas.current = roletaConfigService.getAll().then((r) => r ?? []).catch(() => []);
  }, []);
  const escolherPersona = async (p: PersonaGravavel) => {
    const lista = await roletas.current;
    return gravar(personaParaPatch(p, agent, roletaDoNumero(lista, agent.inbox_id)), ['transfer_config.voice']);
  };

  const semDono = persona === 'broker' && !!agent.inbox_id && !agent.number_owner_id;
  const nome = agent.lead_facing_name ?? '';
  const fala = previaConversa({ persona, nome, imobiliaria }).find((m) => m.de === 'ia')?.texto ?? '';

  return (
    <Secoes>
      <Secao titulo="Persona" descricao="Em nome de quem ela fala. Muda a apresentação e pra quem o lead vai.">
        <CartoesDeEscolha<PersonaGravavel> rotulo="Persona" valor={persona} opcoes={PERSONAS}
          aoEscolher={(p) => void escolherPersona(p)} />
        {semDono && <Aviso tom="vermelho">{FRASE_SEM_DONO}</Aviso>}
      </Secao>
      <Secao titulo="Nome" descricao="O nome que ela diz pro lead. O nome interno só aparece aqui no LM Flow.">
        <div className="grid gap-4 md:grid-cols-2">
          <TextoNaHora id="identidade-nome-lead" rotulo="Nome que o lead vê" salvo={nome} maxLength={60}
            placeholder={persona === 'broker' ? agent.number_owner_name ?? 'Bruno' : persona === 'owner' ? 'Carlos' : 'Bia'}
            aviso={nome.trim() ? undefined : 'Sem ele, ela se apresenta sem nome.'}
            aoGravar={(v) => gravar({ lead_facing_name: v.trim() ? v.trim() : null })} />
          <TextoNaHora id="identidade-nome-interno" rotulo="Nome interno" salvo={agent.name}
            aoGravar={(v) => (v.trim() ? gravar({ name: v.trim() }) : undefined)} />
        </div>
        <p className="max-w-sm rounded-2xl rounded-bl-sm border border-border bg-background px-3.5 py-2.5 text-sm leading-snug">{fala}</p>
      </Secao>
    </Secoes>
  );
}
