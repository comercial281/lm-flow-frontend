// "Receber os leads dos próprios imóveis" (11/11/2026, pedido da Mais Que Imóveis).
//
// O corretor se coloca como Corretor responsável e liga "Leads deste imóvel vão direto para
// o responsável", só para si, com a chave `properties.own_leads` (o gestor liga por cargo).
// Quem lê a equipe (`users.read`: gestor e administrador) escolhe qualquer pessoa, como sempre.
//
// A porta de verdade é o servidor (Properties::LeadOwnerRule no backend): ele recusa o que
// esta regra esconde. Ela existe para a tela não oferecer o que o servidor vai recusar.
import { useContext } from 'react';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useCan } from '@/hooks/useCan';
import { useAuthStore } from '@/store/authStore';

export const SEM_A_CHAVE = 'Só a gestão muda o corretor responsável e para onde vão os leads deste imóvel.';
export const DE_OUTRO_RESPONSAVEL = 'Este imóvel já tem outro corretor responsável. Fale com a gestão.';
export const CAPTACAO_DE_COLEGA = 'Este imóvel é captação de outro corretor. Fale com a gestão.';

export interface EntradaDaRegra {
  /** Lê a equipe: escolhe qualquer pessoa. */
  escolheQualquer: boolean;
  /** Tem a chave `properties.own_leads`. */
  recebeOsProprios: boolean;
  meuId: string | null;
  /** O responsável gravado (nulo em imóvel novo). */
  responsavelAntes: string | null | undefined;
  /** O responsável escolhido agora no formulário. */
  responsavelAgora: string | null | undefined;
  /** O captador escolhido agora no formulário. */
  captadorAgora: string | null | undefined;
}

export interface RegraDoResponsavel {
  /** O seletor de Corretor responsável fica aberto. */
  podeTrocar: boolean;
  /** A própria pessoa aparece no seletor (quem lê a equipe já tem todo mundo na lista). */
  euNoSeletor: boolean;
  /** A chave de leads fica aberta. */
  podeMexerNaChave: boolean;
  /** Por que está travado, quando está. */
  motivo: string | null;
}

const texto = (v: string | null | undefined) => String(v ?? '').trim();

export function regraDoResponsavel(e: EntradaDaRegra): RegraDoResponsavel {
  if (e.escolheQualquer) return { podeTrocar: true, euNoSeletor: false, podeMexerNaChave: true, motivo: null };

  const eu = texto(e.meuId);
  if (!e.recebeOsProprios || !eu) {
    return { podeTrocar: false, euNoSeletor: false, podeMexerNaChave: false, motivo: SEM_A_CHAVE };
  }

  const antes = texto(e.responsavelAntes);
  const agora = texto(e.responsavelAgora);
  const captador = texto(e.captadorAgora);
  const livreOuMeu = !antes || antes === eu;
  const captacaoOk = !captador || captador === eu;
  const podeMexerNaChave = antes === eu || agora === eu;

  let motivo: string | null = null;
  if (!livreOuMeu) motivo = DE_OUTRO_RESPONSAVEL;
  else if (!captacaoOk && agora !== eu) motivo = CAPTACAO_DE_COLEGA;

  return { podeTrocar: livreOuMeu, euNoSeletor: livreOuMeu && captacaoOk, podeMexerNaChave, motivo };
}

/**
 * Quem nasce Corretor responsável em imóvel novo: a própria pessoa, se ela tem a chave e não
 * lê a equipe. A chave de leads NÃO nasce ligada: tirar o lead da roleta é decisão por imóvel.
 * Nulo até as permissões chegarem (`can()` responde não enquanto carrega).
 */
export function useResponsavelPadrao(): string | null {
  const meuId = useAuthStore(s => s.currentUser?.id);
  const permissoes = useContext(PermissionsContext);
  const can = useCan();
  if (!permissoes?.isReady || permissoes.loadFailure) return null;
  if (!can('properties', 'own_leads') || can('users', 'read')) return null;
  return meuId ? String(meuId) : null;
}
