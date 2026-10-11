import React, { useState, useEffect } from 'react';
import { Button } from '@evoapi/design-system/button';
import { Play, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { macrosService } from '@/services/macros/macrosService';
import type { Macro } from '@/types/automation';
import { useLanguage } from '@/hooks/useLanguage';
import { useConfirmacao } from '@/hooks/useConfirmacao';

interface MacrosListProps {
  conversationId: string;
  onMacroExecuted?: () => void;
}

const MacrosList: React.FC<MacrosListProps> = ({ conversationId, onMacroExecuted }) => {
  const { t } = useLanguage('chat');
  const [macros, setMacros] = useState<Macro[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [executingMacro, setExecutingMacro] = useState<string | number | null>(null);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  useEffect(() => {
    loadMacros();
  }, []);

  const loadMacros = async () => {
    try {
      setIsLoading(true);
      const response = await macrosService.getMacros();
      setMacros(response.data || []);
    } catch (error) {
      console.error('Error loading macros:', error);
      toast.error(t('contactSidebar.macros.loading'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleMacroClick = async (macro: Macro) => {
    const ok = await confirmar({
      titulo: t('contactSidebar.macros.dialog.title'),
      descricao: t('contactSidebar.macros.dialog.description', {
        name: macro.name || '',
        count: macro.actions.length || 0,
        actionLabel:
          (macro.actions.length || 0) === 1
            ? t('contactSidebar.macros.action')
            : t('contactSidebar.macros.actions'),
      }),
      rotuloDeCancelar: t('contactSidebar.macros.dialog.cancel'),
      rotuloDaAcao: t('contactSidebar.macros.dialog.execute'),
    });
    if (ok) await executeMacro(macro);
  };

  const executeMacro = async (selectedMacro: Macro) => {
    try {
      setExecutingMacro(selectedMacro.id);
      await macrosService.executeMacro({
        macroId: String(selectedMacro.id),
        conversationIds: [conversationId],
      });
      toast.success(t('contactSidebar.macros.executeSuccess', { name: selectedMacro.name }));
      onMacroExecuted?.();
    } catch (error) {
      console.error('Error executing macro:', error);
      toast.error(t('contactSidebar.macros.executeError', { name: selectedMacro.name }));
    } finally {
      setExecutingMacro(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (macros.length === 0) {
    return (
      <div className="text-center py-6">
        <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{t('contactSidebar.macros.noMacros')}</p>
      </div>
    );
  }

  return (
    <>
      <div
        className="max-h-[280px] overflow-y-auto overflow-x-hidden pr-1 space-y-2 overscroll-contain [scrollbar-width:thin]"
      >
        {macros.map(macro => (
          <div
            key={macro.id}
            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex-1 min-w-0 mr-2">
              <h4 className="text-sm font-medium truncate">{macro.name}</h4>
              <p className="text-xs text-muted-foreground">
                {macro.actions.length}{' '}
                {macro.actions.length === 1
                  ? t('contactSidebar.macros.action')
                  : t('contactSidebar.macros.actions')}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleMacroClick(macro)}
              disabled={executingMacro === macro.id}
              className="h-8 w-8 p-0 shrink-0"
              aria-label={`Executar ${macro.name}`}
              title={`Executar ${macro.name}`}
            >
              {executingMacro === macro.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </div>
        ))}
      </div>

      {dialogoDeConfirmacao}
    </>
  );
};

export default MacrosList;
