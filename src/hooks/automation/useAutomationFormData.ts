import { useEffect, useState } from 'react';
import { automationService } from '@/services/automation/automationService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';

export interface AutomationFormDataOption {
  id: string | number;
  name: string;
}

export interface AutomationFormData {
  inboxes: AutomationFormDataOption[];
  agents: AutomationFormDataOption[];
  teams: AutomationFormDataOption[];
  labels: AutomationFormDataOption[];
  pipelines: AutomationFormDataOption[];
  pipelineStages: AutomationFormDataOption[];
  priorities: AutomationFormDataOption[];
  statuses: AutomationFormDataOption[];
  messageTypes: AutomationFormDataOption[];
}

const HARDCODED_PRIORITIES: AutomationFormDataOption[] = [
  { id: 'low', name: 'low' },
  { id: 'medium', name: 'medium' },
  { id: 'high', name: 'high' },
  { id: 'urgent', name: 'urgent' },
];

const HARDCODED_STATUSES: AutomationFormDataOption[] = [
  { id: 'open', name: 'open' },
  { id: 'resolved', name: 'resolved' },
  { id: 'snoozed', name: 'snoozed' },
  { id: 'pending', name: 'pending' },
];

const HARDCODED_MESSAGE_TYPES: AutomationFormDataOption[] = [
  { id: 0, name: 'incoming' },
  { id: 1, name: 'outgoing' },
  { id: 2, name: 'activity' },
  { id: 3, name: 'template' },
];

const toOption = (raw: { id: string | number; name?: string; title?: string }): AutomationFormDataOption => ({
  id: raw.id,
  name: raw.name ?? raw.title ?? String(raw.id),
});

export function useAutomationFormData(): {
  data: AutomationFormData;
  isLoading: boolean;
  error: Error | null;
} {
  const [data, setData] = useState<AutomationFormData>({
    inboxes: [],
    agents: [],
    teams: [],
    labels: [],
    pipelines: [],
    pipelineStages: [],
    priorities: HARDCODED_PRIORITIES,
    statuses: HARDCODED_STATUSES,
    messageTypes: HARDCODED_MESSAGE_TYPES,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [formDataResult, pipelinesResult] = await Promise.allSettled([
          automationService.getFormData(),
          pipelinesService.getPipelines().catch(() => null),
        ]);

        if (cancelled) return;

        const formData =
          formDataResult.status === 'fulfilled'
            ? formDataResult.value
            : { inboxes: [], agents: [], teams: [], labels: [] };

        const pipelinesPayload =
          pipelinesResult.status === 'fulfilled' && pipelinesResult.value
            ? pipelinesResult.value
            : null;

        const pipelinesArray =
          (pipelinesPayload as { data?: { id: string; name: string }[] } | null)?.data ?? [];

        let allStages: AutomationFormDataOption[] = [];
        if (pipelinesArray.length > 0) {
          const stagesResults = await Promise.allSettled(
            pipelinesArray.map((p) => pipelinesService.getPipelineStages(p.id)),
          );
          allStages = stagesResults.flatMap((res) => {
            if (res.status !== 'fulfilled' || !res.value) return [];
            const stages =
              (res.value as { data?: { id: string; name: string }[] }).data ?? [];
            return stages.map(toOption);
          });
        }

        if (cancelled) return;

        setData({
          inboxes: (formData.inboxes ?? []).map(toOption),
          agents: (formData.agents ?? []).map(toOption),
          teams: (formData.teams ?? []).map(toOption),
          labels: (formData.labels ?? []).map(toOption),
          pipelines: pipelinesArray.map(toOption),
          pipelineStages: allStages,
          priorities: HARDCODED_PRIORITIES,
          statuses: HARDCODED_STATUSES,
          messageTypes: HARDCODED_MESSAGE_TYPES,
        });
      } catch (e) {
        if (!cancelled) setError(e as Error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}
