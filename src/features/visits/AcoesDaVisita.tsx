// src/features/visits/AcoesDaVisita.tsx
/**
 * Botões da visita numa peça só: o card do lead e a Agenda usam esta mesma
 * peça, então a regra de qual botão aparece (`botoesDaVisita`) e o que cada um
 * faz não divergem entre as telas.
 *
 * Desenho fechado com o Tony em 10/10 (specs/2026-10-10-visitas-frente-4-design.md):
 * antes do horário Remarcar | Cancelar (+ Confirmar); depois Não compareceu |
 * Remarcar + Realizada em destaque embaixo; Realizada sem retorno só "Dar retorno".
 * "Não compareceu" pergunta antes (encerra a visita) e oferece abrir uma visita
 * nova com o mesmo cliente, imóvel e corretor.
 */
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, CheckCircle2, MessageSquare, Star, UserX, XCircle } from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Label as UILabel, Textarea,
} from '@/components/ui/ds';
import { ScheduleVisitDialog } from '@/components/visits/ScheduleVisitDialog';
import { visitsService, type Visit } from '@/services/visits/visitsService';
import { useCan } from '@/hooks/useCan';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { dataCurta, hora } from '@/lib/formato';
import { botoesDaVisita, type BotaoDaVisita } from './acaoDaVisita';

type Dialogo = null | 'realizada' | 'retorno' | 'cancelar' | 'nao_compareceu' | 'remarcar_agora';

const VERMELHO = 'text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800';

export function AcoesDaVisita({ visita, onAtualizada }: { visita: Visit; onAtualizada: (v: Visit) => void }) {
  const pode = useCan();
  const podeNa = {
    confirmar: pode('visits', 'confirm'),
    remarcar: pode('visits', 'reschedule'),
    cancelar: pode('visits', 'cancel'),
    concluir: pode('visits', 'complete'),
  };
  const botoes = botoesDaVisita(visita, podeNa);

  // "Não compareceu" só avisa quem usa a peça no FIM do fluxo (Agora não, fechar
  // ou janela da visita nova fechada). Avisar na hora trocaria a visita na lista
  // (a aba "Agendadas" a tiraria) e desmontaria esta peça antes do "Remarcar agora?".
  const pendente = useRef<Visit | null>(null);
  const liberarPendente = () => {
    const v = pendente.current;
    pendente.current = null;
    if (v) onAtualizada(v);
  };

  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [remarcando, setRemarcando] = useState(false);
  const [novaVisita, setNovaVisita] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [motivo, setMotivo] = useState('');

  // Depois de "Não compareceu" a visita fica sem botão nenhum, mas a pergunta
  // "Remarcar agora?" e a janela da visita nova ainda precisam continuar na tela.
  if (botoes.length === 0 && !dialogo && !remarcando && !novaVisita) return null;

  const abrir = (d: Exclude<Dialogo, null>) => {
    setNota(0);
    setComentario('');
    setMotivo('');
    setDialogo(d);
  };

  /** Roda a ação no servidor; devolve a visita salva ou null se deu erro. */
  const salvar = async (acao: () => Promise<Visit>, sucesso: string, adiarAviso = false): Promise<Visit | null> => {
    setSalvando(true);
    try {
      const v = await acao();
      toast.success(sucesso);
      if (adiarAviso) pendente.current = v;
      else onAtualizada(v);
      return v;
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não deu para salvar'));
      // 422/404: a visita mudou noutra tela (encerrada, remarcada, apagada).
      // Traz a versão atual pra os botões pararem de oferecer o que não vale mais.
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 422 || status === 404) {
        setDialogo(null);
        visitsService.get(visita.id).then(onAtualizada).catch(() => {});
      }
      return null;
    } finally {
      setSalvando(false);
    }
  };

  const confirmarDialogo = async () => {
    const comentarioLimpo = comentario.trim() || undefined;
    if (dialogo === 'realizada') {
      if (await salvar(() => visitsService.complete(visita.id, nota || undefined, comentarioLimpo), 'Visita marcada como realizada')) setDialogo(null);
    } else if (dialogo === 'retorno') {
      if (await salvar(() => visitsService.feedback(visita.id, nota || undefined, comentarioLimpo), 'Retorno salvo')) setDialogo(null);
    } else if (dialogo === 'cancelar') {
      if (await salvar(() => visitsService.cancel(visita.id, motivo.trim() || undefined), 'Visita cancelada')) setDialogo(null);
    } else if (dialogo === 'nao_compareceu') {
      if (await salvar(() => visitsService.noShow(visita.id), 'Marcado que o cliente não veio', true)) setDialogo('remarcar_agora');
    }
  };

  const clicar = (b: BotaoDaVisita) => {
    if (b === 'confirmar') void salvar(() => visitsService.confirm(visita.id), 'Visita confirmada');
    else if (b === 'remarcar') setRemarcando(true);
    else if (b === 'cancelar') abrir('cancelar');
    else if (b === 'nao_compareceu') abrir('nao_compareceu');
    else if (b === 'realizada') abrir('realizada');
    else abrir('retorno');
  };

  const deCima = botoes.filter(b => b !== 'realizada');
  const comEstrelas = dialogo === 'realizada' || dialogo === 'retorno';
  const retornoVazio = dialogo === 'retorno' && !nota && !comentario.trim();
  const quando = `${dataCurta(visita.scheduled_at)} às ${hora(visita.scheduled_at)}`;
  const nomeDoCliente = visita.contact?.name ?? 'Cliente';

  const tituloDoDialogo =
    dialogo === 'realizada' ? 'Marcar visita como realizada'
      : dialogo === 'retorno' ? 'Dar retorno da visita'
        : dialogo === 'cancelar' ? 'Cancelar visita'
          : dialogo === 'nao_compareceu' ? `O cliente não veio à visita de ${quando}?`
            : 'Remarcar agora?';
  const botaoDoDialogo =
    dialogo === 'realizada' ? 'Confirmar realização'
      : dialogo === 'retorno' ? 'Salvar retorno'
        : dialogo === 'cancelar' ? 'Cancelar visita'
          : 'Não compareceu';
  const destrutivo = dialogo === 'cancelar' || dialogo === 'nao_compareceu';

  return (
    <>
      {deCima.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {deCima.map(b => (
            <Button
              key={b}
              size="sm"
              variant="outline"
              className={`h-7 text-xs ${b === 'cancelar' || b === 'nao_compareceu' ? VERMELHO : ''}`}
              disabled={salvando}
              onClick={() => clicar(b)}
            >
              {b === 'confirmar' && <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Confirmar</>}
              {b === 'remarcar' && <><CalendarClock className="h-3.5 w-3.5 mr-1" />Remarcar</>}
              {b === 'cancelar' && <><XCircle className="h-3.5 w-3.5 mr-1" />Cancelar</>}
              {b === 'nao_compareceu' && <><UserX className="h-3.5 w-3.5 mr-1" />Não compareceu</>}
              {b === 'retorno' && <><MessageSquare className="h-3.5 w-3.5 mr-1" />Dar retorno</>}
            </Button>
          ))}
        </div>
      )}
      {botoes.includes('realizada') && (
        <Button size="sm" className="mt-2 h-8 w-full" disabled={salvando} onClick={() => clicar('realizada')}>
          Realizada
        </Button>
      )}

      <Dialog open={dialogo !== null} onOpenChange={aberto => {
        if (aberto || salvando) return;
        setDialogo(null);
        if (dialogo === 'remarcar_agora') liberarPendente();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tituloDoDialogo}</DialogTitle>
            {dialogo === 'remarcar_agora' && (
              <DialogDescription>
                Abre uma visita nova para {nomeDoCliente}, com o mesmo imóvel e corretor.
              </DialogDescription>
            )}
          </DialogHeader>

          {comEstrelas && (
            <div className="space-y-4 py-2">
              <div>
                <UILabel>Avaliação (1-5)</UILabel>
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNota(n)}
                      aria-label={`Avaliar com ${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
                      title={`Avaliar com ${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
                    >
                      <Star className={`h-6 w-6 ${n <= nota ? 'text-violet-400 fill-violet-400' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <UILabel>Feedback do cliente</UILabel>
                <Textarea
                  value={comentario}
                  onChange={e => setComentario(e.target.value)}
                  rows={3}
                  placeholder="Como foi a visita? Interesse do cliente?"
                  className="mt-1 resize-none"
                />
              </div>
            </div>
          )}

          {dialogo === 'cancelar' && (
            <div className="py-2">
              <UILabel>Motivo do cancelamento</UILabel>
              <Textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                rows={3}
                placeholder="Opcional"
                className="mt-1 resize-none"
              />
            </div>
          )}

          <DialogFooter>
            {dialogo === 'remarcar_agora' ? (
              <>
                <Button variant="outline" onClick={() => { setDialogo(null); liberarPendente(); }}>Agora não</Button>
                <Button onClick={() => { setDialogo(null); setNovaVisita(true); }}>Remarcar</Button>
              </>
            ) : (
              <>
                <Button variant="outline" disabled={salvando} onClick={() => setDialogo(null)}>Voltar</Button>
                <Button
                  variant={destrutivo ? 'destructive' : 'default'}
                  disabled={salvando || retornoVazio}
                  onClick={confirmarDialogo}
                >
                  {salvando ? 'Salvando...' : botaoDoDialogo}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScheduleVisitDialog
        open={remarcando}
        onOpenChange={setRemarcando}
        visitaParaRemarcar={visita}
        onCreated={onAtualizada}
      />
      <ScheduleVisitDialog
        open={novaVisita}
        onOpenChange={aberto => { setNovaVisita(aberto); if (!aberto) liberarPendente(); }}
        leadInicial={{
          id: visita.contact_id,
          name: nomeDoCliente,
          phone_number: visita.contact?.phone_number ?? null,
          in_pipeline: false,
          owner: visita.realtor ?? null,
        }}
        imovelInicial={visita.property ?? null}
        onCreated={nova => { liberarPendente(); onAtualizada(nova); }}
      />
    </>
  );
}
