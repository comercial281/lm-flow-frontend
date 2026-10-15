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

// Configurações do fluxo: "Pode rodar de novo pro mesmo lead" (sprint 2,
// spec 03/10/2026, seção 3) e "Só em horário comercial" (sprint 3). Rascunho
// local, como a janela do gatilho; o fluxo vai pro servidor no Salvar do topo
// do canvas.

export interface FlowSettings {
  reentry: ReentrySetting;
  businessHoursOnly: boolean;
}

interface Props {
  open: boolean;
  settings: FlowSettings;
  /** O evento do gatilho, pro aviso de "Mensagem recebida". */
  triggerEvent: string;
  onClose: () => void;
  onSave: (next: FlowSettings) => void;
}

export function FlowSettingsDialog({ open, settings, triggerEvent, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<ReentrySetting>(settings.reentry);
  const [businessHoursOnly, setBusinessHoursOnly] = useState(settings.businessHoursOnly);

  React.useEffect(() => {
    if (open) {
      setDraft(settings.reentry);
      setBusinessHoursOnly(settings.businessHoursOnly);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- reabre a partir do que está no canvas

  const warning = reentryWarning(draft, triggerEvent);
  const pick = (mode: ReentryMode) => setDraft(d => ({ ...d, mode }));

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações do fluxo</DialogTitle>
          <DialogDescription>Quando o mesmo lead pode passar por este fluxo outra vez, e em que horário as mensagens saem.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
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
          <Button onClick={() => onSave({ reentry: draft, businessHoursOnly })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
