// src/pages/Customer/Settings/Listas/Listas.tsx
import { useSearchParams } from 'react-router-dom';
import Abas from '@/components/base/Abas';
import BaseHeader from '@/components/base/BaseHeader';
import Pagina from '@/components/base/Pagina';
import { useCan } from '@/hooks/useCan';
import type { ListKey } from '@/services/listOptions/listOptionsService';
import ListaDeOpcoes, { TEXTOS_DA_LISTA } from './ListaDeOpcoes';

// ── MINHA IMOBILIÁRIA › LISTAS (E1 do funil, 07/10/2026) ────────────────────
//
// As listas da casa que o cliente edita: motivos de perda e categorias de
// tarefa. Moldura e cabeçalho do padrão de telas: `Pagina` + `BaseHeader`, como
// a RoletaLista; a lista em si é estreita (max-w-3xl) e fica à esquerda.
// A aba fica no endereço (`?aba=categorias`; sem parâmetro = motivos).
//
// Quem pode mudar é o servidor (`pipelines.update`); aqui a mesma chave só
// decide se a tela oferece editar.

const ABA_DO_ENDERECO: Record<string, ListKey> = { categorias: 'task_categories' };

export default function Listas() {
  const [params, setParams] = useSearchParams();
  const listKey: ListKey = ABA_DO_ENDERECO[params.get('aba') ?? ''] ?? 'loss_reasons';
  const pode = useCan();
  const podeEditar = pode('pipelines', 'update');

  const trocarAba = (chave: string) => {
    const novo = new URLSearchParams(params);
    if (chave === 'task_categories') novo.set('aba', 'categorias');
    else novo.delete('aba');
    setParams(novo, { replace: true });
  };

  return (
    <Pagina
      cabecalho={(
        <BaseHeader
          title="Listas"
          subtitle="As opções que a equipe escolhe no dia a dia: o motivo de um lead perdido e a categoria de uma tarefa."
        />
      )}
    >
      <Abas
        rotulo="Listas"
        ativa={listKey}
        aoTrocar={trocarAba}
        abas={[
          { chave: 'loss_reasons', rotulo: TEXTOS_DA_LISTA.loss_reasons.rotulo },
          { chave: 'task_categories', rotulo: TEXTOS_DA_LISTA.task_categories.rotulo },
        ]}
      />
      <ListaDeOpcoes key={listKey} listKey={listKey} podeEditar={podeEditar} />
    </Pagina>
  );
}
