import type { AgentPlaybook } from '@/services/salesAgents/salesAgentsService';
import { TIPO_VENDA_PADRAO, VOCABULARIO_POR_TIPO, type AssistenteAnswers } from '../assistenteMapping';
import { TIPOS_DE_VENDA_RESERVA } from '../assistenteOpcoes';
import { CampoTexto, CartaoEscolha, Interruptor, Secao } from './Campos';

const DESCRICAO_DO_TIPO: Record<string, string> = {
  lancamento: 'Na planta ou em obras. A visita é ao decorado ou plantão. É o padrão da casa.',
  usado: 'Já construído, pronto para morar. A visita é no próprio imóvel.',
  loteamento: 'Terrenos e lotes. O que se visita é o loteamento e o lote.',
  locacao: 'Aluguel. O passo seguinte costuma ser visita e proposta rápida.',
  misto: 'Mais de um tipo na mesma carteira. A IA adapta pelo imóvel de origem.',
};

/**
 * Etapa 2 — O que vocês vendem.
 *
 * O tipo de venda é o ponto-chave de maior alcance: o método da casa foi escrito
 * em volta de lançamento na planta, e é este seletor que manda o modelo reler
 * "visita", "decorado" e "plantão" para o tipo certo.
 */
export default function EtapaOQueVende({
  a, set, playbook,
}: {
  a: AssistenteAnswers;
  set: (patch: Partial<AssistenteAnswers>) => void;
  playbook: AgentPlaybook | null;
}) {
  const tipos = (playbook?.sale_types?.length ? playbook.sale_types : TIPOS_DE_VENDA_RESERVA).map((t) => ({
    value: t.value,
    title: t.label,
    desc: DESCRICAO_DO_TIPO[t.value] ?? '',
  }));

  // Trocar o tipo troca o termo junto, a menos que a pessoa já tenha escrito o
  // dela: comparar com o padrão do tipo ANTERIOR é o que separa os dois casos.
  const escolherTipo = (tipo: string) => {
    const termoEraPadrao = a.termo_imovel.trim().toUpperCase() === (VOCABULARIO_POR_TIPO[a.tipo_venda || TIPO_VENDA_PADRAO] ?? '');
    set({ tipo_venda: tipo, termo_imovel: termoEraPadrao ? (VOCABULARIO_POR_TIPO[tipo] ?? a.termo_imovel) : a.termo_imovel });
  };

  return (
    <div className="space-y-8">
      <Secao titulo="Tipo de venda" ajuda="Muda como a IA fala do produto e o que ela chama de próximo passo.">
        <CartaoEscolha nome="Tipo de venda" opcoes={tipos} value={a.tipo_venda || TIPO_VENDA_PADRAO} onChange={escolherTipo} colunas={2} />
      </Secao>

      <Secao titulo="Como vocês chamam o que vendem" ajuda="A palavra que a IA usa no lugar de “imóvel”.">
        <CampoTexto id="as_termo" label="Termo" value={a.termo_imovel} onChange={(v) => set({ termo_imovel: v })}
          placeholder={VOCABULARIO_POR_TIPO[a.tipo_venda || TIPO_VENDA_PADRAO]}
          ajuda={`Padrão para este tipo: ${VOCABULARIO_POR_TIPO[a.tipo_venda || TIPO_VENDA_PADRAO] ?? 'IMÓVEL'}. Só é gravado se for diferente.`} />
      </Secao>

      <Secao titulo="Locação">
        <Interruptor id="as_locacao" on={a.locacao_enabled} onChange={(v) => set({ locacao_enabled: v })}
          titulo="Trabalha com locação (aluguel)"
          desc="Desligado, a IA foca em venda e redireciona quem procura aluguel." />
      </Secao>
    </div>
  );
}
