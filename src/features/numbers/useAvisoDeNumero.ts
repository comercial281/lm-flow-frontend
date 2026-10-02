import { useContext } from 'react';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useCan } from '@/hooks/useCan';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import { avisoListaVazia, type AvisoListaVazia } from './avisoConversas';
import { useNumerosDaConversa } from './useNumerosDaConversa';

// "Gestor" = quem vê qualquer número (`inboxes.update`, o mesmo sinal da tela
// de Canais); sem as permissões carregadas a tela não decide nada.
export function usePermissoesDeNumero() {
  const permissoes = useContext(PermissionsContext);
  const can = useCan();
  const permissoesProntas = permissoes ? permissoes.isReady : true;
  const gestor = permissoesProntas && can('inboxes', 'update');
  const podeCriarNumero = useFeature('channels_connect') && permissoesProntas && can('channels', 'create');
  return { permissoesProntas, gestor, podeCriarNumero };
}

// Aviso de número (sem número / número fora do ar) para a lista e o painel
// vazio da direita. Null enquanto as permissões ou os números não chegaram.
export function useAvisoDeNumero(): AvisoListaVazia | null {
  const { numeros } = useNumerosDaConversa();
  const { permissoesProntas, gestor, podeCriarNumero } = usePermissoesDeNumero();
  if (!permissoesProntas) return null;
  return avisoListaVazia({ numeros, gestor, podeCriar: podeCriarNumero });
}
