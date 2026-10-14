// Abre a janela de agendar visita a partir do card do lead (botão da coluna
// fixa ou "Agendar visita" de um cartão de imóvel). Ao criar, põe a etiqueta
// 'visita-agendada' na conversa, menos quando a visita já foi realizada.
import { useCallback, useState, Suspense, type ReactNode } from 'react';
import { conversationAPI } from '@/services/conversations/conversationService';
import { lazyWithRetry } from '@/utils/chunkReload';
import { conversaDoCard, leadParaVisita } from '@/features/cardDoLead/cardDoLead';
import type { PipelineItem } from '@/types/analytics';

const ScheduleVisitDialog = lazyWithRetry(() =>
  import('@/components/visits/ScheduleVisitDialog').then(m => ({ default: m.ScheduleVisitDialog })),
);

const VISIT_SCHEDULED_LABEL = 'visita-agendada';

type ImovelDaVisita = { id: string; title: string; code: string };

export function useAgendarVisitaDoCard(
  item: PipelineItem,
  nomeExibido: string,
  onVisitaCriada?: () => void,
): { abrir: (imovel?: ImovelDaVisita | null) => void; janela: ReactNode } {
  const convId = conversaDoCard(item);
  const lead = leadParaVisita(item, nomeExibido);
  const [aberta, setAberta] = useState(false);
  const [imovel, setImovel] = useState<ImovelDaVisita | null>(null);

  const abrir = useCallback((i?: ImovelDaVisita | null) => {
    setImovel(i ?? null);
    setAberta(true);
  }, []);

  const janela = aberta ? (
    <Suspense fallback={null}>
      <ScheduleVisitDialog
        open={aberta}
        onOpenChange={setAberta}
        leadInicial={lead}
        imovelInicial={imovel}
        onCreated={v => {
          setAberta(false);
          // Visita registrada como realizada (dia que já passou) não está
          // agendada: a etiqueta mentiria na conversa.
          if (convId && v.status !== 'completed') {
            conversationAPI.addLabels(convId, [VISIT_SCHEDULED_LABEL]).catch(() => {});
          }
          onVisitaCriada?.();
        }}
      />
    </Suspense>
  ) : null;

  return { abrir, janela };
}
