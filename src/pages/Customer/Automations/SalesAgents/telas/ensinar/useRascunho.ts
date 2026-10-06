/**
 * O rascunho de UM bloco com Salvar: a pessoa mexe à vontade, a BarraSalvar aparece
 * quando há alteração, e o Salvar manda só os campos do bloco que mudaram
 * (features/salesAgents/patchDoPasso.ts), direto no serviço — nunca pelo `saveAgent`
 * campo a campo da tela antiga.
 *
 * Onda 3 (06/10/2026): as páginas do Configurar gravam na hora (`useGravarNaHora`);
 * sobrou só o *Como ela atende* do Ensinar, exceção consciente (Ensinar fora do
 * escopo), por isso o hook mora aqui e não mais no `configurar/`.
 *
 * O rascunho recomeça do salvo quando a IA muda ou volta do servidor com conteúdo
 * novo (`id` + `updated_at`).
 *
 * ⚠️ Não recomeçar só porque o OBJETO do agente trocou: uma releitura da casca (ou
 * um pai que remonta o agente a cada render) apagaria a edição não salva sem aviso,
 * ou entraria em laço.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { salesAgentsService, type SalesAgent, type SalesAgentPayload } from '@/services/salesAgents/salesAgentsService';
import { useAlteracoesNaoSalvas } from '@/hooks/useAlteracoesNaoSalvas';
import { montarPatch } from '@/features/salesAgents/patchDoPasso';
import { motivoEscrito } from '@/features/salesAgents/erroDoServidor';

export function useRascunho(agent: SalesAgent, campos: readonly string[], aoSalvo: (a: SalesAgent) => void) {
  const [rascunho, setRascunho] = useState<SalesAgent>(agent);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ultimo = useRef(agent);
  ultimo.current = agent;
  const versao = `${agent.id}|${agent.updated_at ?? ''}`;
  useEffect(() => {
    setRascunho(ultimo.current);
    setErro(null);
  }, [versao]);

  const patch = useMemo(() => montarPatch(agent, rascunho, campos), [agent, rascunho, campos]);
  const pendente = Object.keys(patch).length > 0;
  useAlteracoesNaoSalvas(pendente);

  const mudar = useCallback((p: Partial<SalesAgent>) => setRascunho((r) => ({ ...r, ...p })), []);

  const descartar = useCallback(() => {
    setRascunho(agent);
    setErro(null);
  }, [agent]);

  const salvar = useCallback(async (): Promise<{ atualizado: SalesAgent; patch: Partial<SalesAgentPayload> } | null> => {
    // Clique duplo no Salvar mandaria dois PATCH.
    if (!pendente || salvando) return null;
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
  }, [agent.id, patch, pendente, salvando, aoSalvo]);

  return { rascunho, mudar, pendente, salvando, erro, salvar, descartar, patch };
}
