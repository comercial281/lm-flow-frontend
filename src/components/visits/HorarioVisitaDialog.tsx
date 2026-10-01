/**
 * "Horário de visita" da imobiliária (chave `agenda_do_corretor`, só gestor e
 * administrador — o botão some para o corretor, e o servidor recusa com 403).
 *
 * Um horário só para todos: dias da semana, faixa de horas (de 30 em 30, em
 * lista, nunca o campo de hora do navegador) e feriados/datas fechadas. Vale
 * para a IA e para quem marca à mão. Quando a chave é ligada, o horário nasce
 * copiado da IA principal; se havia IAs com horários diferentes, avisa qual
 * foi usada (`seeded_from`).
 * Spec: specs/2026-10-01-fase-4-agenda-do-corretor-design.md (pasta LM FLOW).
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Input, Label as UILabel,
} from '@/components/ui/ds';
import { NativeSelect } from '@/components/ui/native-select';
import IconActionButton from '@/components/base/IconActionButton';
import { PilulasDias } from '@/pages/Customer/Automations/SalesAgents/assistente/steps/Campos';
import { agendaService } from '@/services/visits/agendaService';
import { avisoSemente, horariosDe30em30, type SeededFrom } from '@/features/visits/agenda';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { data } from '@/lib/formato';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Estado = 'carregando' | 'erro' | 'desligada' | 'pronto';

const HORAS = horariosDe30em30();

export function HorarioVisitaDialog({ open, onOpenChange }: Props) {
  const [estado, setEstado] = useState<Estado>('carregando');
  const [dias, setDias] = useState<number[]>([]);
  const [inicio, setInicio] = useState('08:00');
  const [fim, setFim] = useState('20:00');
  const [fechadas, setFechadas] = useState<string[]>([]);
  const [novaData, setNovaData] = useState('');
  const [semente, setSemente] = useState<SeededFrom | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    let vivo = true;
    setEstado('carregando');
    setErro(null);
    setNovaData('');
    agendaService.getSettings()
      .then(s => {
        if (!vivo) return;
        if (!s.enabled) { setEstado('desligada'); return; }
        setDias(s.days ?? []);
        setInicio(s.start);
        setFim(s.end);
        setFechadas(s.closed_dates ?? []);
        setSemente(s.seeded_from);
        setEstado('pronto');
      })
      .catch(() => { if (vivo) setEstado('erro'); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    return carregar();
  }, [open, carregar]);

  const adicionarData = () => {
    if (!novaData || fechadas.includes(novaData)) { setNovaData(''); return; }
    setFechadas([...fechadas, novaData].sort());
    setNovaData('');
  };

  const salvar = async () => {
    if (dias.length === 0) { setErro('Escolha pelo menos um dia'); return; }
    if (fim <= inicio) { setErro('O fim precisa ser depois do início'); return; }
    setErro(null);
    setSalvando(true);
    try {
      await agendaService.updateSettings({
        days: dias.slice().sort((a, b) => a - b),
        start: inicio,
        end: fim,
        closed_dates: fechadas,
      });
      toast.success('Horário de visita salvo');
      onOpenChange(false);
    } catch (e) {
      setErro(apiErrorMessage(e, 'Não deu para salvar. Tente de novo.'));
    } finally {
      setSalvando(false);
    }
  };

  const aviso = avisoSemente(semente);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Horário de visita</DialogTitle>
          <DialogDescription>Vale para a IA e para quem marca à mão. Fora disso, nenhuma visita é marcada.</DialogDescription>
        </DialogHeader>

        {estado === 'carregando' && <p className="py-4 text-sm text-muted-foreground">Carregando...</p>}

        {estado === 'erro' && (
          <div className="space-y-3 py-4">
            <p className="text-sm text-destructive">Não deu para carregar o horário de visita.</p>
            <Button type="button" variant="outline" size="sm" onClick={carregar}>Tentar de novo</Button>
          </div>
        )}

        {estado === 'desligada' && (
          <p className="py-4 text-sm text-muted-foreground">A agenda do corretor não está ligada.</p>
        )}

        {estado === 'pronto' && (
          <div className="space-y-5 py-2">
            {aviso && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {aviso}
              </p>
            )}

            <div role="group" aria-label="Dias da semana">
              <UILabel>Dias da semana</UILabel>
              <div className="mt-1">
                <PilulasDias value={dias} onChange={setDias} />
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="w-32">
                <UILabel htmlFor="hv_inicio">Início</UILabel>
                <NativeSelect id="hv_inicio" className="mt-1" value={inicio} onChange={e => setInicio(e.target.value)}>
                  {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                </NativeSelect>
              </div>
              <div className="w-32">
                <UILabel htmlFor="hv_fim">Fim</UILabel>
                <NativeSelect id="hv_fim" className="mt-1" value={fim} onChange={e => setFim(e.target.value)}>
                  {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                </NativeSelect>
              </div>
            </div>

            <div>
              <UILabel htmlFor="hv_data">Feriados e datas fechadas</UILabel>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Input
                  id="hv_data"
                  type="date"
                  aria-label="Data fechada"
                  className="w-auto"
                  value={novaData}
                  onChange={e => setNovaData(e.target.value)}
                />
                <Button type="button" variant="outline" size="sm" onClick={adicionarData} disabled={!novaData}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Adicionar data
                </Button>
              </div>
              {fechadas.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nenhuma data fechada.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {fechadas.map(d => (
                    <li key={d} className="flex items-center gap-1 rounded-md border border-border py-0.5 pl-2 pr-0.5 text-sm">
                      <span className="tabular-nums">{data(d)}</span>
                      <IconActionButton
                        label={`Remover ${data(d)}`}
                        icon={<X className="h-3.5 w-3.5" />}
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => setFechadas(fechadas.filter(x => x !== d))}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {estado === 'pronto' && (
            <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
