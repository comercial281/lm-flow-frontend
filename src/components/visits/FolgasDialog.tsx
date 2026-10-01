/**
 * Folgas do corretor (agenda ligada no servidor). Na folga ninguém marca
 * visita para ele: nem a IA, nem o gestor, nem ele mesmo.
 *
 * Folga = um período (início e fim) com o dia inteiro ou uma faixa de horas.
 * Período com faixa vale a faixa em CADA dia do período ("07/10 a 09/10, das
 * 14h às 18h" = três tardes), regra do servidor.
 *
 * Corretor (`soMinhas`, o `meta.only_mine` da Agenda): vê e cria só as dele,
 * sem escolher ninguém — o servidor força ele mesmo. Gestor: vê as de todos e
 * escolhe o corretor com os mesmos botões do Agendar visita.
 * Spec: specs/2026-10-01-fase-4-agenda-do-corretor-design.md (pasta LM FLOW).
 */
import { useCallback, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import {
  Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Input, Label as UILabel,
} from '@/components/ui/ds';
import { NativeSelect } from '@/components/ui/native-select';
import { EscolhaCorretor } from '@/components/visits/EscolhaCorretor';
import { agendaService, type TimeOff } from '@/services/visits/agendaService';
import { visitsService, type PersonRef } from '@/services/visits/visitsService';
import { horariosDe30em30, ordenarFolgas, rotuloFolga } from '@/features/visits/agenda';
import { diaISO } from '@/features/visits/daySlots';
import { apiErrorMessage } from '@/utils/apiHelpers';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Corretor isolado (só as folgas dele). */
  soMinhas: boolean;
}

const HORAS = horariosDe30em30();

export function FolgasDialog({ open, onOpenChange, soMinhas }: Props) {
  const [folgas, setFolgas] = useState<TimeOff[] | null>(null);
  const [erroLista, setErroLista] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const [corretores, setCorretores] = useState<PersonRef[] | null>(null);
  const [erroCorretores, setErroCorretores] = useState(false);
  const [corretor, setCorretor] = useState<PersonRef | null>(null);

  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [das, setDas] = useState('14:00');
  const [ate, setAte] = useState('18:00');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const idDiaInteiro = useId();

  // Só as que ainda não acabaram: as de hoje em diante.
  const carregarLista = useCallback(() => {
    let vivo = true;
    setErroLista(false);
    agendaService.listTimeOffs({ from: diaISO(new Date()) })
      .then(lista => { if (vivo) setFolgas(ordenarFolgas(lista)); })
      .catch(() => { if (vivo) { setFolgas(null); setErroLista(true); } });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    setFolgas(null);
    setConfirmando(null);
    setCorretor(null);
    setInicio('');
    setFim('');
    setDiaInteiro(true);
    setDas('14:00');
    setAte('18:00');
    setMotivo('');
    setErro(null);
    const pararLista = carregarLista();
    let vivo = true;
    if (!soMinhas) {
      setCorretores(null);
      setErroCorretores(false);
      visitsService.realtors()
        .then(lista => { if (vivo) setCorretores(lista); })
        .catch(() => { if (vivo) setErroCorretores(true); });
    }
    return () => { vivo = false; pararLista(); };
  }, [open, soMinhas, carregarLista]);

  const criar = async () => {
    if (!soMinhas && !corretor) { setErro('Escolha o corretor'); return; }
    if (!inicio) { setErro('Escolha o dia em que a folga começa'); return; }
    const termina = fim || inicio;
    if (termina < inicio) { setErro('A folga precisa terminar depois de começar'); return; }
    if (!diaInteiro && ate <= das) { setErro('O fim precisa ser depois do início'); return; }
    setErro(null);
    setSalvando(true);
    try {
      await agendaService.createTimeOff({
        ...(soMinhas ? {} : { user_id: corretor!.id }),
        starts_on: inicio,
        ends_on: termina,
        start_time: diaInteiro ? null : das,
        end_time: diaInteiro ? null : ate,
        note: motivo.trim() || null,
      });
      toast.success('Folga criada');
      setInicio('');
      setFim('');
      setMotivo('');
      carregarLista();
    } catch (e) {
      setErro(apiErrorMessage(e, 'Não deu para criar a folga. Tente de novo.'));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id: string) => {
    setExcluindo(true);
    try {
      await agendaService.removeTimeOff(id);
      toast.success('Folga excluída');
      setConfirmando(null);
      carregarLista();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não deu para excluir a folga. Tente de novo.'));
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{soMinhas ? 'Minhas folgas' : 'Folgas'}</DialogTitle>
          <DialogDescription>Na folga, ninguém marca visita para o corretor: nem a IA, nem quem marca à mão.</DialogDescription>
        </DialogHeader>

        <section aria-label="Próximas folgas" className="space-y-2 py-2">
          <h3 className="text-sm font-medium">Próximas folgas</h3>
          {erroLista ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">Não deu para carregar as folgas.</p>
              <Button type="button" variant="outline" size="sm" onClick={carregarLista}>Tentar de novo</Button>
            </div>
          ) : folgas === null ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : folgas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma folga marcada.</p>
          ) : (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {folgas.map(f => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    {!soMinhas && f.user_name && <span className="font-medium">{f.user_name} · </span>}
                    <span>{rotuloFolga(f)}</span>
                    {f.note && <span className="block text-xs text-muted-foreground">{f.note}</span>}
                  </div>
                  {confirmando === f.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Excluir esta folga?</span>
                      <Button type="button" size="sm" variant="destructive" disabled={excluindo} onClick={() => excluir(f.id)}>
                        Sim, excluir
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setConfirmando(null)}>Não</Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={`Excluir folga de ${rotuloFolga(f)}`}
                      title={`Excluir folga de ${rotuloFolga(f)}`}
                      onClick={() => setConfirmando(f.id)}
                    >
                      Excluir
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Nova folga" className="space-y-4 border-t border-border pt-4">
          <h3 className="text-sm font-medium">Nova folga</h3>

          {!soMinhas && (
            <div>
              <span className="text-sm text-muted-foreground">De quem é a folga *</span>
              <EscolhaCorretor
                corretores={corretores}
                erro={erroCorretores}
                valor={corretor}
                onEscolher={setCorretor}
                rotulo="De quem é a folga"
              />
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <UILabel htmlFor="folga_inicio">Começa em</UILabel>
              <Input
                id="folga_inicio"
                type="date"
                className="mt-1 w-auto"
                min={diaISO(new Date())}
                value={inicio}
                onChange={e => setInicio(e.target.value)}
              />
            </div>
            <div>
              <UILabel htmlFor="folga_fim">Termina em</UILabel>
              <Input
                id="folga_fim"
                type="date"
                className="mt-1 w-auto"
                min={inicio || diaISO(new Date())}
                value={fim}
                onChange={e => setFim(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id={idDiaInteiro} checked={diaInteiro} onCheckedChange={v => setDiaInteiro(v === true)} />
            <label htmlFor={idDiaInteiro} className="cursor-pointer text-sm">Dia inteiro</label>
          </div>

          {!diaInteiro && (
            <div className="space-y-1">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-32">
                  <UILabel htmlFor="folga_das">Das</UILabel>
                  <NativeSelect id="folga_das" className="mt-1" value={das} onChange={e => setDas(e.target.value)}>
                    {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                  </NativeSelect>
                </div>
                <div className="w-32">
                  <UILabel htmlFor="folga_ate">Até</UILabel>
                  <NativeSelect id="folga_ate" className="mt-1" value={ate} onChange={e => setAte(e.target.value)}>
                    {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                  </NativeSelect>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">A faixa vale em cada dia do período.</p>
            </div>
          )}

          <div>
            <UILabel htmlFor="folga_motivo">Motivo (opcional)</UILabel>
            <Input
              id="folga_motivo"
              className="mt-1"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex.: consulta médica"
            />
          </div>

          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={criar} disabled={salvando}>{salvando ? 'Salvando...' : 'Criar folga'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
