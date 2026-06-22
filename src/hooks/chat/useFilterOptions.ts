import { useState, useEffect } from 'react';
import InboxesService from '@/services/channels/inboxesService';
import chatService from '@/services/chat/chatService';
import { pipelinesService } from '@/services/pipelines';
import { Inbox } from '@/types/channels/inbox';
import type { Pipeline, Label, Team } from '@/types/chat/api';

interface FilterOptions {
  inboxes: Array<{ label: string; value: string }>;
  teams: Array<{ label: string; value: string }>;
  labels: Array<{ label: string; value: string }>;
  pipelines: Array<{ label: string; value: string }>;
  stages: Array<{ label: string; value: string }>;
  loading: boolean;
  error: string | null;
}

interface UseFilterOptionsParams {
  /**
   * Se false, não carrega dados automaticamente
   * Útil para carregar apenas quando modal é aberto
   * @default true
   */
  enabled?: boolean;
}

export const useFilterOptions = (params: UseFilterOptionsParams = {}): FilterOptions => {
  const { enabled = true } = params;

  const [options, setOptions] = useState<FilterOptions>({
    inboxes: [],
    teams: [],
    labels: [],
    pipelines: [],
    stages: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;

    const loadOptions = async () => {
      setOptions(prev => ({ ...prev, loading: true, error: null }));

      try {
        // ✅ Carregar inboxes, pipelines, labels, teams e etapas
        const [inboxesResponse, pipelinesResponse, labelsResponse, teamsResponse, stagesResponse] =
          await Promise.allSettled([
            InboxesService.list(),
            chatService.getAvailablePipelines(),
            chatService.getAvailableLabels(),
            chatService.getAvailableTeams(),
            pipelinesService.getPipelines({ include_items: false }),
          ]);

        // ✅ Processar inboxes
        const inboxes: Array<{ label: string; value: string }> = [];
        if (inboxesResponse.status === 'fulfilled') {
          inboxes.push(
            ...inboxesResponse.value.data.map((inbox: Inbox) => {
              // Extrair o nome do tipo do canal (ex: "Channel::Whatsapp" -> "WhatsApp")
              const channelTypeName =
                inbox.channel_type?.split('::')[1] || inbox.channel_type || 'Unknown';
              return {
                label: `${inbox.name} (${channelTypeName})`,
                value: inbox.id.toString(),
              };
            }),
          );
        }

        // ✅ Processar pipelines
        const pipelines: Array<{ label: string; value: string }> = [];
        if (pipelinesResponse.status === 'fulfilled') {
          // O chatService já processa a resposta e retorna Pipeline[]
          const pipelinesData = pipelinesResponse.value || [];

          if (Array.isArray(pipelinesData)) {
            pipelines.push(
              ...pipelinesData.map((pipeline: Pipeline) => ({
                label: pipeline.name,
                value: pipeline.id.toString(),
              })),
            );
          } else {
            console.warn('⚠️ Pipelines data não é um array:', pipelinesData);
          }
        }

        // ✅ Processar labels (o backend filtra por NOME da tag → value = title)
        const labels: Array<{ label: string; value: string }> = [];
        if (labelsResponse.status === 'fulfilled') {
          const raw = labelsResponse.value;
          const list = Array.isArray(raw) ? raw : (raw as { data?: Label[] })?.data || [];
          labels.push(
            ...list
              .filter((l: Label) => !!l?.title)
              .map((l: Label) => ({ label: l.title, value: l.title })),
          );
        }

        // ✅ Processar teams (filtra por id)
        const teams: Array<{ label: string; value: string }> = [];
        if (teamsResponse.status === 'fulfilled') {
          const raw = teamsResponse.value;
          const list = Array.isArray(raw) ? raw : (raw as { data?: Team[] })?.data || [];
          teams.push(
            ...list
              .filter((tm: Team) => !!tm?.name)
              .map((tm: Team) => ({ label: tm.name, value: tm.id.toString() })),
          );
        }

        // ✅ Processar etapas (coluna) de todos os pipelines → "Pipeline › Etapa"
        const stages: Array<{ label: string; value: string }> = [];
        if (stagesResponse.status === 'fulfilled') {
          const list = stagesResponse.value?.data || [];
          list.forEach(pipeline => {
            (pipeline.stages || []).forEach(stage => {
              stages.push({
                label: `${pipeline.name} › ${stage.name}`,
                value: stage.id.toString(),
              });
            });
          });
        }

        setOptions({
          inboxes,
          teams,
          labels,
          pipelines,
          stages,
          loading: false,
          error: null,
        });

        // ✅ Log de erros individuais sem falhar o hook
        if (inboxesResponse.status === 'rejected') {
          console.warn('Erro ao carregar inboxes:', inboxesResponse.reason);
        }
        if (pipelinesResponse.status === 'rejected') {
          console.warn('Erro ao carregar pipelines:', pipelinesResponse.reason);
        }
      } catch (error) {
        console.error('Erro ao carregar opções de filtro:', error);
        setOptions(prev => ({
          ...prev,
          loading: false,
          error: 'Erro ao carregar opções de filtro',
        }));
      }
    };

    loadOptions();
  }, [enabled]);

  return options;
};
