// Modo operante (Tarefa 71, 01/11/2026): o que ela faz, o que oferece no fim e quando passa o
// lead antes da hora. Entrega BLOCOS (a moldura é o Card da página). Tudo grava na hora.
//
// ⚠️ A agenda da visita (BlocoDaAgenda) só aparece no Leva até a visita; "Pediu pra visitar" só
// no Filtra e passa. O trabalho gravado (`job`) manda; agente sem `job` segue o servidor.
// ⚠️ Toda escrita das exceções manda as cinco prontas inteiras + as escritas (o servidor troca o
// jsonb todo): mexer numa nunca apaga as outras. O último próximo passo não desmarca.
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button, Checkbox, Input } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import { Campo, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import type { ExcecaoPronta, Job, NextStep } from '@/services/salesAgents/salesAgentsService';
import { perguntasDoAgente } from '@/features/salesAgents/perguntas';
import {
  ORDEM_DAS_PRONTAS, ORDEM_DOS_PASSOS, ROTULO_DA_EXCECAO, ROTULO_DO_PASSO, SEMPRE_LIGADAS, fraseDeFechamento, prontasDoAgente,
} from '@/features/salesAgents/modoOperante';
import TextoNaHora from '../TextoNaHora';
import { agendamentoTravado, type PropsDaPagina } from '../paginas';
import BlocoDaAgenda from './BlocoDaAgenda';

function Caixa({ rotulo, marcada, desabilitada, nota, aoMudar }: {
  rotulo: string; marcada: boolean; desabilitada?: boolean; nota?: string; aoMudar: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <Checkbox checked={marcada} disabled={desabilitada} aria-label={rotulo} onCheckedChange={(v) => aoMudar(v === true)} />
      <span>{rotulo}</span>
      {nota && <span className="text-xs text-muted-foreground">{nota}</span>}
    </label>
  );
}

export default function ModoOperante(props: PropsDaPagina) {
  const { agent, gravar } = props;
  const [nova, setNova] = useState('');
  const leva = !agendamentoTravado(agent);
  const job: Job = leva ? 'leva_visita' : 'filtra_passa';
  const passos: NextStep[] = agent.next_steps?.length ? agent.next_steps : ['visita'];
  const prontas = prontasDoAgente(agent);
  const escritas = agent.handoff_exceptions?.escritas ?? [];
  const perguntas = perguntasDoAgente(agent);
  const obrigatorias = perguntas.filter((p) => p.obrigatoria).length;

  const mudarPasso = (passo: NextStep, ligado: boolean) => {
    const proximos = ORDEM_DOS_PASSOS.filter((p) => (p === passo ? ligado : passos.includes(p)));
    if (proximos.length === 0) return undefined; // o último não desmarca
    return gravar({ next_steps: proximos });
  };
  const gravarExcecoes = (p: Record<ExcecaoPronta, boolean>, e: string[]) => gravar({ handoff_exceptions: { prontas: p, escritas: e } });
  const por = () => {
    const texto = nova.trim();
    if (!texto || escritas.some((e) => e.toLowerCase() === texto.toLowerCase())) return;
    void gravarExcecoes(prontas, [...escritas, texto]).then((ok) => { if (ok) setNova(''); });
  };

  const casa = agent.house_voice ?? {};

  return (
    <>
      <Secoes>
        <Secao titulo="O que ela faz" descricao="Até onde ela leva a conversa antes de passar pra uma pessoa.">
          <CartoesDeEscolha<Job> rotulo="O que ela faz" valor={job} aoEscolher={(j) => void gravar({ job: j })}
            opcoes={[
              { valor: 'filtra_passa', rotulo: 'Filtra e passa',
                descricao: `Passa quando as obrigatórias estão respondidas (${obrigatorias} de ${perguntas.length} na Condução).` },
              { valor: 'leva_visita', rotulo: 'Leva até a visita', descricao: 'Marca na agenda e só passa com a visita marcada.' },
            ]} />
          {leva && (
            <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
              Agenda: a do corretor do número, com o calendário pronto (ela nunca calcula data de cabeça). Os ajustes da agenda estão logo abaixo.
            </p>
          )}
        </Secao>

        <Secao titulo="Próximo passo" descricao="Ela oferece os marcados e o lead escolhe. Pelo menos um fica marcado.">
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {ORDEM_DOS_PASSOS.map((p) => (
              <li key={p}>
                <Caixa rotulo={ROTULO_DO_PASSO[p]} marcada={passos.includes(p)} desabilitada={passos.includes(p) && passos.length === 1}
                  aoMudar={(v) => void mudarPasso(p, v)} />
              </li>
            ))}
          </ul>
          <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm">Ela fecha com: <i>&ldquo;{fraseDeFechamento(job, passos)}&rdquo;</i></p>
          {passos.includes('reuniao') && (
            <TextoNaHora id="modo-endereco" rotulo="Endereço do escritório" salvo={casa.office_address ?? ''} maxLength={200}
              placeholder="Rua, número, bairro e cidade"
              ajuda="É o que ela diz pro lead na reunião no escritório. Sem ele, ela não oferece essa opção."
              aoGravar={(v) => gravar({ house_voice: { ...casa, office_address: v.trim() || undefined } }, ['house_voice.office_address'])} />
          )}
        </Secao>

        <Secao titulo="Passa na hora quando" descricao="Fora da regra do modo operante: nestes casos ela passa o lead sem esperar o resto.">
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Sempre ligadas">
            {SEMPRE_LIGADAS.map((t) => <li key={t} className="text-sm text-muted-foreground">{t}</li>)}
          </ul>
          <p className="text-xs text-muted-foreground">Sempre ligadas.</p>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {ORDEM_DAS_PRONTAS.filter((k) => k !== 'pediu_pra_visitar' || !leva).map((k) => (
              <li key={k}>
                <Caixa rotulo={ROTULO_DA_EXCECAO[k]} marcada={prontas[k]} aoMudar={(v) => void gravarExcecoes({ ...prontas, [k]: v }, escritas)} />
              </li>
            ))}
          </ul>
          {escritas.length > 0 && (
            <ul className="space-y-2" aria-label="Escritas por vocês">
              {escritas.map((e) => (
                <li key={e} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                  <span>{e} <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">escrita por vocês</span></span>
                  <button type="button" aria-label={`Tirar: ${e}`} className="text-muted-foreground hover:text-foreground"
                    onClick={() => void gravarExcecoes(prontas, escritas.filter((x) => x !== e))}>
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <Campo id="modo-escrita" rotulo="Outro motivo" className="flex-1">
              <Input id="modo-escrita" className={CLASSE_DO_CAMPO} value={nova} maxLength={200}
                placeholder="Em português: ex. pediu financiamento com renda informal"
                onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); por(); } }} />
            </Campo>
            <Button type="button" variant="outline" className="h-11" disabled={!nova.trim()} onClick={por}>Pôr</Button>
          </div>
        </Secao>
      </Secoes>
      {leva && <BlocoDaAgenda {...props} />}
    </>
  );
}
