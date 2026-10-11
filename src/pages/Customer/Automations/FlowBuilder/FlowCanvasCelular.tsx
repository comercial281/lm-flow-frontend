import { ArrowLeft, Monitor } from 'lucide-react';
import { Card } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import Chave from '@/components/base/Chave';
import Pagina from '@/components/base/Pagina';
import BaseHeader from '@/components/base/BaseHeader';
import EmptyState from '@/components/base/EmptyState';
import type { FlowAutomationKind } from '@/types/flowAutomations';

// ── CONSTRUTOR NO CELULAR (Raio-X do celular, 10/10/2026) ────────────────────
//
// O desenho não abre numa tela pequena: no lugar dele, o nome, a chave de ligar
// (a MESMA ação do canvas, que vem de fora) e o aviso de abrir no computador.
// Sem Salvar, Blocos, Simular nem Configurações. Quem decide se a tela é esta
// é o canvas, só na abertura (girar o celular não troca a tela).

const TEXTOS: Record<FlowAutomationKind, { aviso: string; chave: string }> = {
  automation: { aviso: 'Pra editar este fluxo, abra no computador.', chave: 'Ligar o fluxo' },
  followup: { aviso: 'Pra editar este follow-up, abra no computador.', chave: 'Ligar o fluxo' },
  conversation: { aviso: 'Pra editar este funil, abra no computador.', chave: 'Ligar o funil' },
};

export const AVISO_NAO_SALVO_NO_CELULAR = 'Há alterações não salvas: abra no computador pra salvar.';

interface FlowCanvasCelularProps {
  kind: FlowAutomationKind;
  nome: string;
  ligado: boolean;
  /** Funil da equipe que a pessoa só vê: sem a chave, como no canvas. */
  soVer: boolean;
  /**
   * Tem alteração não salva (veio do computador): no celular não dá pra salvar,
   * então a chave some e a tela diz o que fazer, em vez de recusar ao virar.
   */
  naoSalvo: boolean;
  aoMudarLigado: () => Promise<boolean>;
  aoVoltar: () => void;
}

export default function FlowCanvasCelular({
  kind, nome, ligado, soVer, naoSalvo, aoMudarLigado, aoVoltar,
}: FlowCanvasCelularProps) {
  const textos = TEXTOS[kind];
  return (
    <Pagina
      acima={
        <button
          type="button"
          onClick={aoVoltar}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </button>
      }
      cabecalho={<BaseHeader title={nome} />}
    >
      {!soVer && naoSalvo && (
        <Aviso tom="atencao">{AVISO_NAO_SALVO_NO_CELULAR}</Aviso>
      )}
      {!soVer && !naoSalvo && (
        <Card className="gap-0 p-4" data-testid="chave-no-celular">
          <Chave rotulo={textos.chave} ligada={ligado} aoMudar={aoMudarLigado} />
        </Card>
      )}
      <EmptyState
        icon={Monitor}
        title={textos.aviso}
        description={soVer
          ? 'No celular o desenho não abre. No computador dá pra ver os passos e duplicar.'
          : 'No celular dá pra ligar e desligar. Mexer nos blocos, salvar e simular fica pro computador.'}
      />
    </Pagina>
  );
}
