/**
 * Corretor em botões, para o gestor: todos os corretores ativos da imobiliária
 * (`GET /visits/realtors`), sem digitar, com rolagem se forem muitos. Usado no
 * Agendar visita e nas Folgas.
 *
 * `corretores === null` = ainda carregando; `erro` = a lista não veio.
 */
import { Button } from '@/components/ui/ds';
import type { PersonRef } from '@/services/visits/visitsService';

export function EscolhaCorretor({ corretores, erro, valor, onEscolher, rotulo = 'Corretor responsável' }: {
  corretores: PersonRef[] | null;
  erro: boolean;
  valor: PersonRef | null;
  onEscolher: (p: PersonRef) => void;
  /** Nome do grupo de botões para o leitor de tela. */
  rotulo?: string;
}) {
  if (erro) {
    return <p className="mt-1 text-sm text-destructive">Não deu para carregar os corretores. Feche e abra de novo.</p>;
  }
  if (corretores === null) {
    return <p className="mt-1 text-sm text-muted-foreground">Carregando...</p>;
  }
  if (corretores.length === 0) {
    return <p className="mt-1 text-sm text-muted-foreground">Nenhum corretor ativo na equipe.</p>;
  }
  return (
    <div role="group" aria-label={rotulo} className="mt-1 flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
      {corretores.map(c => {
        const escolhido = valor?.id === c.id;
        return (
          <Button
            key={c.id}
            type="button"
            size="sm"
            variant={escolhido ? 'default' : 'outline'}
            aria-pressed={escolhido}
            onClick={() => onEscolher(c)}
          >
            {c.name}
          </Button>
        );
      })}
    </div>
  );
}
