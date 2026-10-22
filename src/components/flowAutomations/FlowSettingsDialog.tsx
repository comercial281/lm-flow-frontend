import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, Button, Input, Checkbox,
} from '@/components/ui/ds';
import {
  REENTRY_OPTIONS,
  reentryWarning,
  type ReentryMode,
  type ReentrySetting,
} from '@/features/flowAutomations/reentry';
import Aviso from '@/components/base/Aviso';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import { CampoDaJanela, GrupoDaJanela } from '@/components/base/janela';
import { BUSINESS_HOURS_FLOW_HELP, BUSINESS_HOURS_LABEL } from '@/features/flowAutomations/businessHours';
import { Seletor } from '@/components/base/Seletor';
import {
  FLOW_CONFLICT_GROUP, FLOW_CONFLICT_OPTIONS, FLOW_NUMBER_DIVERGENT, FLOW_NUMBER_GROUP, FLOW_NUMBER_OPTIONS, asksConflict,
  type FlowNumberSetting,
} from '@/features/flowAutomations/flowNumber';
import {
  missingSelection, missingSelectionLabel, numberOptionLabel, type SendFromMode, type SendNumberOption, type SendNumbersState,
} from '@/features/numbers/sendFrom';
import type { NumberConflictMode } from '@/types/flowAutomations';

// Configurações do fluxo: "Pode rodar de novo pro mesmo lead" (sprint 2,
// spec 03/10/2026, seção 3) e "Só em horário comercial" (sprint 3). Rascunho
// local, como a janela do gatilho; o fluxo vai pro servidor no Salvar do topo
// do canvas.
//
// Entrega 4: no fluxo da equipe, "Por qual número este fluxo fala com o lead"
// (um número só pro fluxo inteiro) e o que fazer quando o lead já conversa com
// a equipe em outro número. Quem decide é o servidor.

export interface FlowSettings {
  reentry: ReentrySetting;
  businessHoursOnly: boolean;
  /**
   * A regra de número do fluxo. Na entrada: ausente em follow-up, funil de
   * conversa e automação pessoal (o grupo nem aparece). No `onSave`: só vem
   * quando a pessoa MEXEU no grupo nesta abertura; fluxo antigo que ninguém
   * mexeu continua salvando igual a hoje.
   */
  number?: FlowNumberSetting;
}

interface Props {
  open: boolean;
  settings: FlowSettings;
  /** O evento do gatilho, pro aviso de "Mensagem recebida". */
  triggerEvent: string;
  onClose: () => void;
  onSave: (next: FlowSettings) => void;
  /** Fluxo antigo cujas Mensagens saem por números diferentes: avisa e não marca nenhum. */
  numberDivergent?: boolean;
  /** Os números do "Por um número específico" (o canvas busca). */
  numbers?: SendNumberOption[];
  numbersState?: SendNumbersState | 'idle';
}

export function FlowSettingsDialog({
  open, settings, triggerEvent, onClose, onSave, numberDivergent = false, numbers = [], numbersState = 'loaded',
}: Props) {
  const [draft, setDraft] = useState<ReentrySetting>(settings.reentry);
  const [businessHoursOnly, setBusinessHoursOnly] = useState(settings.businessHoursOnly);
  const [number, setNumber] = useState<FlowNumberSetting | undefined>(settings.number);
  // Mexeu no grupo do número nesta abertura (escolher o mesmo do divergente conta).
  const [numberTouched, setNumberTouched] = useState(false);

  React.useEffect(() => {
    if (open) {
      setDraft(settings.reentry);
      setBusinessHoursOnly(settings.businessHoursOnly);
      setNumber(settings.number);
      setNumberTouched(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- reabre a partir do que está no canvas

  const warning = reentryWarning(draft, triggerEvent);
  const pick = (mode: ReentryMode) => setDraft(d => ({ ...d, mode }));
  const changeNumber = (patch: Partial<FlowNumberSetting>) => {
    setNumber(n => (n ? { ...n, ...patch } : n));
    setNumberTouched(true);
  };
  // Divergente e intocado: nenhum marcado (marcar o "da conversa" diria uma coisa que o fluxo não faz).
  const shownMode: SendFromMode | null = number && numberDivergent && !numberTouched ? null : number?.mode ?? null;
  const missingNumber = !!number && numberTouched && number.mode === 'number' && !number.inboxId;
  const lostNumber = !!number && missingSelection(
    { send_from: number.mode, send_from_inbox_id: number.inboxId }, numbers,
  );
  const save = () => onSave({
    reentry: draft,
    businessHoursOnly,
    ...(number && numberTouched ? { number } : {}),
  });

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações do fluxo</DialogTitle>
          <DialogDescription>Quando o mesmo lead pode passar por este fluxo outra vez, e em que horário as mensagens saem.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {number && (
            <>
            <GrupoDaJanela titulo={FLOW_NUMBER_GROUP}>
              {numberDivergent && !numberTouched && <Aviso tom="atencao" compacto>{FLOW_NUMBER_DIVERGENT}</Aviso>}
              <BotoesDeEscolha
                rotulo={FLOW_NUMBER_GROUP}
                semNome
                valor={shownMode}
                opcoes={FLOW_NUMBER_OPTIONS.map(o => ({ valor: o.value, rotulo: o.label }))}
                aoEscolher={mode => changeNumber({ mode, inboxId: mode === 'number' ? number.inboxId : '' })}
                className="w-full"
              />
              {shownMode === 'number' && (
                <CampoDaJanela rotulo="Número do fluxo" htmlFor="flow-numero">
                  <Seletor
                    id="flow-numero"
                    value={number.inboxId}
                    onChange={e => changeNumber({ inboxId: e.target.value })}
                    className="w-full"
                    aria-label="Número do fluxo"
                  >
                    <option value="">Escolha o número</option>
                    {lostNumber && <option value={number.inboxId}>{missingSelectionLabel(numbersState === 'idle' ? 'loading' : numbersState)}</option>}
                    {numbers.map(n => (
                      <option key={n.inbox_id} value={n.inbox_id}>{numberOptionLabel(n, false)}</option>
                    ))}
                  </Seletor>
                </CampoDaJanela>
              )}
            </GrupoDaJanela>
            {shownMode && asksConflict(shownMode) && (
              <GrupoDaJanela titulo={FLOW_CONFLICT_GROUP}>
                <BotoesDeEscolha
                  rotulo={FLOW_CONFLICT_GROUP}
                  semNome
                  valor={number.onConflict}
                  opcoes={FLOW_CONFLICT_OPTIONS.map(o => ({ valor: o.value, rotulo: o.label }))}
                  aoEscolher={(onConflict: NumberConflictMode) => changeNumber({ onConflict })}
                  className="w-full"
                />
              </GrupoDaJanela>
            )}
            </>
          )}

          <GrupoDaJanela titulo="Pode rodar de novo pro mesmo lead">
            <BotoesDeEscolha
              rotulo="Pode rodar de novo pro mesmo lead"
              semNome
              valor={draft.mode}
              opcoes={REENTRY_OPTIONS.map(o => ({ valor: o.value, rotulo: o.label }))}
              aoEscolher={pick}
              className="w-full"
            />
            {draft.mode === 'hours' && (
              <CampoDaJanela rotulo="Depois de quantas horas" htmlFor="flow-reentry-horas">
                <Input
                  id="flow-reentry-horas"
                  type="number"
                  min={1}
                  className="w-full"
                  value={draft.hours}
                  onChange={e => setDraft({ mode: 'hours', hours: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                  aria-label="Quantas horas"
                />
              </CampoDaJanela>
            )}
            {warning && <Aviso tom="atencao" compacto>{warning}</Aviso>}
          </GrupoDaJanela>

          <GrupoDaJanela titulo="Horário">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={businessHoursOnly}
                onCheckedChange={v => setBusinessHoursOnly(v === true)}
              />
              {BUSINESS_HOURS_LABEL}
            </label>
            <p className="text-xs text-muted-foreground">{BUSINESS_HOURS_FLOW_HELP}</p>
          </GrupoDaJanela>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={missingNumber}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
