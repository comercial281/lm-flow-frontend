// src/features/followup/JanelaColocarEmFollowup.tsx
// "Colocar em follow-up" (Fase 2, 20/10/2026): a janela única que todas as
// portas abrem (soltar o card na coluna Follow-up, mudar a etapa no card e na
// conversa, o Iniciar do bloco Follow-up e o atalho do painel do lead).
//
// O servidor diz tudo (`place_preview`): as opções, o padrão da conta, se o
// lead já está num follow-up, onde ele parou e se o funil tem a coluna. A tela
// só escolhe e manda (`place`). Quem move o card pra coluna é o servidor.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import Aviso from '@/components/base/Aviso';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { CampoDaJanela, ESCOLHA, GradeDaJanela } from '@/components/base/janela';
import {
  flowAutomationInstancesService,
  type ModoDoFollowup,
  type PlacePreview,
  type RefDoLead,
} from '@/services/flowAutomations/flowAutomationInstancesService';
import { httpStatusOf, serverErrorOf } from '@/services/leadFollowup/leadFollowupService';
import { cn } from '@/lib/utils';

export interface ResultadoDoFollowup {
  message?: string;
  /** 201 = começou agora; 200 = o lead já estava nesse follow-up. */
  started: boolean;
}

interface Props {
  lead: RefDoLead;
  aoCancelar: () => void;
  aoConcluir: (resultado: ResultadoDoFollowup) => void;
}

const MIDIA = 'A próxima mensagem é uma mídia (foto, áudio ou vídeo).';

/** Selo da opção: "Do responsável" (o pessoal de quem cuida do lead, que pode não ser quem abre a janela) ou "Da equipe". Sem a informação, só o nome. */
const rotuloDaOpcao = (o: { name: string; team?: boolean }) =>
  o.team === true ? `${o.name} · Da equipe` : o.team === false ? `${o.name} · Do responsável` : o.name;

const motivoDaRecusa = (e: unknown) =>
  serverErrorOf(e)
  || (httpStatusOf(e) === 403 ? 'Seu cargo não permite mexer no follow-up deste lead.' : null)
  || 'Não consegui falar com o servidor. Tente de novo.';

/** O padrão que o servidor marcou (o "meu padrão" do responsável, senão o da conta), se está na lista; senão o primeiro. */
const escolhaInicial = (p: PlacePreview) =>
  p.options.find(o => o.id === p.default_flow_id)?.id ?? p.options[0]?.id ?? '';

export default function JanelaColocarEmFollowup({ lead, aoCancelar, aoConcluir }: Props) {
  const [previa, setPrevia] = useState<PlacePreview | null>(null);
  const [erro, setErro] = useState(false);
  const [escolhido, setEscolhido] = useState('');
  const [modo, setModo] = useState<ModoDoFollowup>('continue');
  const [salvando, setSalvando] = useState(false);

  const { contactId, conversationId, pipelineItemId } = lead;
  const carregar = useCallback(async () => {
    setErro(false);
    setPrevia(null);
    try {
      const p = await flowAutomationInstancesService.placePreview({ contactId, conversationId, pipelineItemId });
      setPrevia(p);
      setEscolhido(escolhaInicial(p));
      setModo('continue');
    } catch {
      setErro(true);
    }
  }, [contactId, conversationId, pipelineItemId]);

  useEffect(() => { void carregar(); }, [carregar]);

  // O progresso vale só pro follow-up em que o lead parou: noutro, começa do início.
  const progresso = previa?.progress && previa.progress.flow_automation_id === escolhido ? previa.progress : null;
  const podeContinuar = Boolean(progresso?.has_next);
  const modoFinal: ModoDoFollowup = podeContinuar && modo === 'continue' ? 'continue' : 'restart';
  // Fase 3: o "mesmo follow-up" é pelo id (dois follow-ups podem ter o mesmo nome: o seu e o da equipe).
  const nomeAtual = previa?.current?.flow_name ?? null;
  const mesmoFollowup = Boolean(previa?.current?.flow_automation_id) && previa?.current?.flow_automation_id === escolhido;
  const avisoDoAtual = !previa?.current
    ? null
    : mesmoFollowup
      ? 'Este lead já está neste follow-up.'
      : nomeAtual
        ? `Este lead já está no follow-up "${nomeAtual}". Iniciar troca pelo escolhido.`
        : 'Este lead já está em um follow-up. Iniciar troca pelo escolhido.';

  const iniciar = async () => {
    if (!escolhido || salvando) return;
    setSalvando(true);
    try {
      const resultado = await flowAutomationInstancesService.place(lead, { flowAutomationId: escolhido, mode: modoFinal });
      toast.success(resultado.message || 'Follow-up iniciado.');
      aoConcluir(resultado);
    } catch (e) {
      toast.error(motivoDaRecusa(e));
      setSalvando(false);
    }
  };

  const fraseDaColuna = useMemo(() => {
    if (!previa) return null;
    return previa.has_followup_column
      ? 'O card vai para a coluna Follow-up.'
      : 'Este funil não tem coluna Follow-up: o follow-up começa e o card fica onde está.';
  }, [previa]);

  return (
    <Dialog open onOpenChange={aberta => { if (!aberta && !salvando) aoCancelar(); }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Colocar em follow-up</DialogTitle>
        </DialogHeader>

        {erro ? (
          <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={() => { void carregar(); }} />
        ) : !previa ? (
          <Carregando variante="texto" linhas={2} rotulo="Carregando os follow-ups" />
        ) : previa.options.length === 0 ? (
          <EmptyState
            tamanho="compacto"
            title="Nenhum follow-up pra iniciar."
            description={<>Crie e ligue um em <em>Funis de mensagem → Follow-up</em>.</>}
          />
        ) : (
          <div className="grid gap-4">
            {avisoDoAtual && <Aviso tom="atencao" compacto>{avisoDoAtual}</Aviso>}

            <GradeDaJanela>
              <CampoDaJanela rotulo="Follow-up" htmlFor="colocar-followup-qual" colunas={4} ajuda={fraseDaColuna}>
                <Seletor
                  id="colocar-followup-qual"
                  className="w-full"
                  value={escolhido}
                  disabled={salvando}
                  onChange={e => { setEscolhido(e.target.value); setModo('continue'); }}
                >
                  {previa.options.map(o => (
                    <option key={o.id} value={o.id}>{rotuloDaOpcao(o)}</option>
                  ))}
                </Seletor>
              </CampoDaJanela>

              {progresso && (
                <CampoDaJanela rotulo="De onde começar" idDoRotulo="colocar-followup-modo" colunas={4}>
                  <div role="group" aria-labelledby="colocar-followup-modo" className="grid gap-2">
                    {podeContinuar && progresso && (
                      <Button
                        type="button"
                        variant="outline"
                        aria-pressed={modoFinal === 'continue'}
                        className={cn('h-auto justify-start whitespace-normal text-left', ESCOLHA)}
                        disabled={salvando}
                        onClick={() => setModo('continue')}
                      >
                        {`Continuar da mensagem ${progresso.step + 1}`}
                      </Button>
                    )}
                    {podeContinuar && (
                      <p className="line-clamp-3 break-words rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        {progresso.next_text ?? MIDIA}
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      aria-pressed={modoFinal === 'restart'}
                      className={cn('h-auto justify-start whitespace-normal text-left', ESCOLHA)}
                      disabled={salvando}
                      onClick={() => setModo('restart')}
                    >
                      Começar do início
                    </Button>
                  </div>
                </CampoDaJanela>
              )}
            </GradeDaJanela>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoCancelar} disabled={salvando}>Cancelar</Button>
          <Button type="button" onClick={() => void iniciar()} disabled={!previa || !escolhido || salvando}>
            {salvando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Iniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
