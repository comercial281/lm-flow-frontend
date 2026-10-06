// Atendimento · Canal (onda 3). Número (cartão com a situação do WhatsApp e
// "Trocar"), Modo (ao vivo + follow-up / só follow-up) e Público (todos / só
// alguns → condições). Tudo grava na hora.
//
// ⚠️ "Só alguns" sem condição nenhuma NÃO grava: só abre o editor. Gravar lista
// vazia é "todos" pro servidor, e a tela ficaria dizendo "só alguns".
// ⚠️ A palavra antiga (`trigger_keyword`) não tem campo: aparece com a frase do que
// ela faz de verdade (§6.11) e "Tirar essa regra".
import { useState } from 'react';
import { Button } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import { Campo, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import { lerEscolhas } from '@/features/salesAgents/tresEscolhas';
import { fraseDaPalavraAntiga } from '@/features/salesAgents/situacao';
import { cn } from '@/lib/utils';
import { TriggersSection } from '../blocos/TriggersSection';
import { Aviso } from '../Aviso';
import type { PropsDaPagina } from '../paginas';

type Modo = 'vivo' | 'so_followup';
type Publico = 'todos' | 'alguns';

export default function Canal({ agent, inboxes, gravar, irPara, diagnostico }: PropsDaPagina) {
  const [trocando, setTrocando] = useState(!agent.inbox_id);
  const [abrindoAlguns, setAbrindoAlguns] = useState(false);
  const temCondicoes = (agent.triggers ?? []).length > 0;
  const publico: Publico = temCondicoes || abrindoAlguns ? 'alguns' : 'todos';
  const numero = inboxes.find((i) => String(i.id) === String(agent.inbox_id ?? ''))?.name ?? agent.inbox_name ?? null;
  const credencial = diagnostico?.items.find((i) => i.key === 'credentials');
  const situacao = !agent.inbox_id || !credencial ? null : credencial.status === 'ok' ? 'Conectado' : 'Desconectado';
  const corretor = lerEscolhas(agent).persona === 'broker';
  const frasePalavra = fraseDaPalavraAntiga(agent);

  const escolherPublico = async (p: Publico) => {
    if (p === 'alguns') { setAbrindoAlguns(true); return; }
    setAbrindoAlguns(false);
    if (temCondicoes) await gravar({ triggers: [] });
  };

  return (
    <Secoes>
      <Secao titulo="Número" descricao="O WhatsApp em que ela recebe e responde os leads.">
        {agent.inbox_id && !trocando ? (
          <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-border bg-background p-3.5">
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', situacao === 'Desconectado' ? 'bg-red-500' : 'bg-emerald-500')} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{numero ?? 'Número escolhido'}</p>
              {situacao && <p className="text-[13px] text-muted-foreground">{situacao}</p>}
            </div>
            <Button type="button" variant="outline" onClick={() => setTrocando(true)}>Trocar</Button>
          </div>
        ) : (
          <Campo id="canal-numero" rotulo="Número de WhatsApp">
            <Seletor id="canal-numero" className={`${CLASSE_DO_CAMPO} w-full`} value={agent.inbox_id ?? ''}
              onChange={(e) => { const id = e.target.value || null; if (id) void gravar({ inbox_id: id }).then((ok) => ok && setTrocando(false)); }}>
              <option value="">Escolha o número</option>
              {inboxes.map((i) => <option key={i.id} value={String(i.id)}>{i.name}</option>)}
            </Seletor>
          </Campo>
        )}
        {corretor && agent.number_owner_name && (
          <p className="text-sm text-muted-foreground">Dono deste número: {agent.number_owner_name}. É pra ele que o lead vai.</p>
        )}
      </Secao>

      <Secao titulo="Modo" descricao={'"Só follow-up" faz ela parar de responder ao vivo e só voltar a chamar quem sumiu.'}>
        <BotoesDeEscolha<Modo> rotulo="Modo" valor={agent.followup_only ? 'so_followup' : 'vivo'}
          opcoes={[{ valor: 'vivo', rotulo: 'Ao vivo + follow-up' }, { valor: 'so_followup', rotulo: 'Só follow-up' }]}
          aoEscolher={(m) => void gravar({ followup_only: m === 'so_followup' })} />
        {agent.followup_only && !agent.followup_enabled && (
          <Aviso>
            <p>Com o follow-up desligado, ela não faz nada neste modo.</p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => irPara('followup')}>Abrir Follow-up</Button>
          </Aviso>
        )}
      </Secao>

      <Secao titulo="Público" descricao="Todos os leads que escrevem no número, ou só os que batem com as condições.">
        {frasePalavra && (
          <Aviso>
            <p>{frasePalavra}</p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void gravar({ trigger_keyword: null })}>
              Tirar essa regra
            </Button>
          </Aviso>
        )}
        <BotoesDeEscolha<Publico> rotulo="Público" valor={publico}
          opcoes={[{ valor: 'todos', rotulo: 'Todos os leads' }, { valor: 'alguns', rotulo: 'Só alguns' }]}
          aoEscolher={(p) => void escolherPublico(p)} />
        {publico === 'alguns' && <TriggersSection agent={agent} onSave={(p) => void gravar(p)} />}
      </Secao>
    </Secoes>
  );
}
