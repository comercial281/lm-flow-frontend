import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, Button, Input,
} from '@/components/ui/ds';
import {
  REENTRY_OPTIONS,
  reentryWarning,
  type ReentryMode,
  type ReentrySetting,
} from '@/features/flowAutomations/reentry';
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

        <fieldset className="space-y-3 py-2">
          <legend className="text-sm font-medium mb-1">Pode rodar de novo pro mesmo lead</legend>
          {REENTRY_OPTIONS.map(option => (
            <div key={option.value}>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="flow-reentry"
                  checked={draft.mode === option.value}
                  onChange={() => pick(option.value)}
                  className="h-4 w-4 accent-primary"
                  aria-label={option.label}
                />
                {option.value === 'hours' ? (
                  <span className="flex items-center gap-2">
                    Depois de
                    <Input
                      type="number"
                      min={1}
                      className="h-8 w-20"
                      value={draft.hours}
                      onFocus={() => pick('hours')}
                      onChange={e => setDraft({ mode: 'hours', hours: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                      aria-label="Quantas horas"
                    />
                    horas
                  </span>
                ) : (
                  option.label
                )}
              </label>
              {option.value === 'always' && warning && (
                <p className="mt-1 ml-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700">
                  {warning}
                </p>
              )}
            </div>
          ))}
        </fieldset>

        <fieldset className="space-y-1 border-t border-border pt-3">
          <legend className="sr-only">Horário</legend>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={businessHoursOnly}
              onChange={e => setBusinessHoursOnly(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            {BUSINESS_HOURS_LABEL}
          </label>
          <p className="ml-6 text-xs text-muted-foreground">{BUSINESS_HOURS_FLOW_HELP}</p>
        </fieldset>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ reentry: draft, businessHoursOnly })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
