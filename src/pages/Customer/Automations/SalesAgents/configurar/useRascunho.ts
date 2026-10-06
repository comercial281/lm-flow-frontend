/**
 * O rascunho de UM passo: a pessoa mexe à vontade, a BarraSalvar aparece quando há
 * alteração, e o Salvar manda só os campos do passo que mudaram
 * (features/salesAgents/patchDoPasso.ts), direto no serviço — nunca pelo `saveAgent`
 * campo a campo da tela antiga.
 *
 * O rascunho recomeça do salvo quando a IA muda ou volta do servidor (o agente que
 * a casca guarda troca de objeto).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { salesAgentsService, type SalesAgent, type SalesAgentPayload } from '@/services/salesAgents/salesAgentsService';
import { useAlteracoesNaoSalvas } from '@/hooks/useAlteracoesNaoSalvas';
import { montarPatch } from '@/features/salesAgents/patchDoPasso';
import { motivoEscrito } from '@/features/salesAgents/erroDoServidor';

export function useRascunho(agent: SalesAgent, campos: readonly string[], aoSalvo: (a: SalesAgent) => void) {
  const [rascunho, setRascunho] = useState<SalesAgent>(agent);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setRascunho(agent);
    setErro(null);
  }, [agent]);

  const patch = useMemo(() => montarPatch(agent, rascunho, campos), [agent, rascunho, campos]);
  const pendente = Object.keys(patch).length > 0;
  useAlteracoesNaoSalvas(pendente);

  const mudar = useCallback((p: Partial<SalesAgent>) => setRascunho((r) => ({ ...r, ...p })), []);

  const descartar = useCallback(() => {
    setRascunho(agent);
    setErro(null);
  }, [agent]);

  const salvar = useCallback(async (): Promise<{ atualizado: SalesAgent; patch: Partial<SalesAgentPayload> } | null> => {
    if (!pendente) return null;
    setSalvando(true);
    setErro(null);
    try {
      const atualizado = await salesAgentsService.update(agent.id, patch);
      aoSalvo(atualizado);
      toast.success('Salvo');
      return { atualizado, patch };
    } catch (e) {
      const motivo = motivoEscrito(e) ?? 'Não deu pra salvar. Tente de novo.';
      setErro(motivo);
      toast.error(motivo);
      return null;
    } finally {
      setSalvando(false);
    }
  }, [agent.id, patch, pendente, aoSalvo]);

  return { rascunho, mudar, pendente, salvando, erro, salvar, descartar, patch };
}
