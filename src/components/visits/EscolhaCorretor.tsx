/**
 * Corretor numa lista de escolha, para o gestor: todos os corretores ativos da imobiliária
 * (`GET /visits/realtors`), sem digitar. Usado no
 * Agendar visita e nas Folgas.
 *
 * `corretores === null` = ainda carregando; `erro` = a lista não veio.
 * `id` liga a lista ao rótulo visível do campo (`htmlFor`); o `aria-label`
 * fica com o mesmo texto do rótulo, sem o asterisco.
 */
import { Seletor } from '@/components/base/Seletor';
import type { PersonRef } from '@/services/visits/visitsService';
import EmptyState from '@/components/base/EmptyState';

export function EscolhaCorretor({ id, corretores, erro, valor, onEscolher, rotulo = 'Corretor responsável' }: {
  id?: string;
  corretores: PersonRef[] | null;
  erro: boolean;
  valor: PersonRef | null;
  onEscolher: (p: PersonRef) => void;
  /** Nome da lista para o leitor de tela. */
  rotulo?: string;
}) {
  if (erro) {
    return <p className="mt-1 text-sm text-destructive">Não deu para carregar os corretores. Feche e abra de novo.</p>;
  }
  if (corretores === null) {
    return <p className="mt-1 text-sm text-muted-foreground">Carregando...</p>;
  }
  if (corretores.length === 0) {
    return <EmptyState tamanho="compacto" title="Nenhum corretor ativo na equipe." className="mt-1 p-3" />;
  }
  return (
    <Seletor
      id={id}
      aria-label={rotulo}
      className="w-full"
      value={valor ? String(valor.id) : ''}
      onChange={e => {
        const c = corretores.find(x => String(x.id) === e.target.value);
        if (c) onEscolher(c);
      }}
    >
      <option value="">Escolha o corretor</option>
      {corretores.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
    </Seletor>
  );
}
