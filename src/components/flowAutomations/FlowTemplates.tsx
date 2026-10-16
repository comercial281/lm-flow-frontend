import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/ds';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation } from '@/types/flowAutomations';
import type { FlowTemplate } from '@/features/flowAutomations/templates';
import { cn } from '@/lib/utils';
import { TemplatePickerDialog } from './TemplatePickerDialog';

// MODELOS (sprint 2, spec 03/10/2026, seção 4): a mesma lista no botão
// "Modelos" e no estado vazio da tela Automações. "Usar este modelo" cria o
// fluxo desligado no servidor e devolve o fluxo pra tela abrir.
//
// Desde 12/10/2026 a janela é a lista com prévia (TemplatePickerDialog). No
// estado vazio os modelos aparecem em cartões; tocar num abre a janela com ele
// escolhido.

const TITLE = 'Modelos de automação';
const DESCRIPTION = 'Escolha um modelo e veja o que ele faz antes de criar. O fluxo nasce desligado: ajuste o que estiver em branco e ligue quando estiver pronto.';
const APPLY_ERROR = 'Não deu pra criar o fluxo pelo modelo. Tente de novo.';

interface ListProps {
  onApplied: (flow: FlowAutomation) => void;
  className?: string;
  /** Só o gestor: aba "Da equipe" = true, "Minhas" = false, outras = sem valor. */
  team?: boolean;
}

export function FlowTemplateList({ onApplied, className, team }: ListProps) {
  const [templates, setTemplates] = useState<FlowTemplate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const loadId = useRef(0);

  const load = useCallback(() => {
    const id = ++loadId.current;
    setFailed(false);
    setTemplates(null);
    flowAutomationsService
      .templates()
      .then(list => { if (id === loadId.current) setTemplates(list); })
      .catch(() => { if (id === loadId.current) setFailed(true); });
  }, []);

  useEffect(load, [load]);

  if (failed) return <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={load} className={className} />;
  if (!templates) return <Carregando variante="lista" linhas={3} rotulo="Carregando os modelos…" className={className} />;
  if (templates.length === 0) return null;

  return (
    <>
      <ul className={cn('grid gap-2 sm:grid-cols-2', className)} aria-label="Modelos de automação">
        {templates.map(t => (
          <li key={t.key}>
            <button type="button" className="group block h-full w-full text-left" onClick={() => setOpenKey(t.key)}>
              <Card className="flex h-full items-center gap-3 p-3 transition-colors group-hover:border-primary/40">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{t.name}</span>
                  {t.when && <span className="block truncate text-xs text-muted-foreground">{t.when}</span>}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Card>
            </button>
          </li>
        ))}
      </ul>
      <TemplatePickerDialog
        open={openKey !== null}
        initialKey={openKey}
        onClose={() => setOpenKey(null)}
        title={TITLE}
        description={DESCRIPTION}
        applyError={APPLY_ERROR}
        team={team}
        onApplied={flow => {
          setOpenKey(null);
          onApplied(flow);
        }}
      />
    </>
  );
}

interface DialogProps extends ListProps {
  open: boolean;
  onClose: () => void;
}

export function FlowTemplatesDialog({ open, onClose, onApplied, team }: DialogProps) {
  return (
    <TemplatePickerDialog
      open={open}
      onClose={onClose}
      title={TITLE}
      description={DESCRIPTION}
      applyError={APPLY_ERROR}
      team={team}
      onApplied={onApplied}
    />
  );
}
