// Passo 5 · O que ela vende. "Como chamar o que você vende" saiu: o termo vem do
// tipo de venda, como o servidor já faz quando o campo está vazio.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/ds';
import { Secao } from '@/components/base/Secao';
import { Campo, CampoTextoLongo, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import type { PlaybookVars } from '@/services/salesAgents/salesAgentsService';
import { propertiesService } from '@/services/properties/propertiesService';
import { TIPO_DE_VENDA_PADRAO, TIPO_DE_VENDA_ROTULOS } from '@/features/salesAgents/rotulosDaIa';
import { useRascunho } from '../useRascunho';
import { CAMPOS_DO_PASSO } from '../camposDosPassos';
import { Caixa, CascaDoPasso } from '../pecas';
import type { PropsDoPasso } from '../passos';

const REGRA_PADRAO_DO_BOOK = 'o lead pedir o book, a apresentação completa, o material ou mais detalhes do empreendimento';

export default function Passo5Vende({ agent, aoSalvo }: PropsDoPasso) {
  const { rascunho, mudar, pendente, salvando, erro, salvar, descartar } = useRascunho(agent, CAMPOS_DO_PASSO[5], aoSalvo);
  const [, setParams] = useSearchParams();
  const [imoveis, setImoveis] = useState<{ code: string; title: string }[]>([]);

  useEffect(() => {
    let vivo = true;
    propertiesService.list({ status: 'active', per_page: 100 })
      .then((res) => { if (vivo) setImoveis((res.data ?? []).map((p) => ({ code: p.code, title: p.title }))); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  const playbook = rascunho.playbook ?? {};
  const vars = (playbook.vars ?? {}) as PlaybookVars;
  const tipo = vars.tipo_venda || TIPO_DE_VENDA_PADRAO;
  const codigo = rascunho.default_property_code ?? '';
  const codigoForaDaLista = codigo && !imoveis.some((i) => i.code === codigo);

  // Lançamento é o padrão de fábrica: gravar o padrão faria a tela mostrar
  // "escolhido" onde nada foi escolhido (mesma regra da seção Roteiro de antes).
  const trocarTipo = (v: string) => {
    const proximos: PlaybookVars = { ...vars };
    if (v === TIPO_DE_VENDA_PADRAO) delete proximos.tipo_venda; else proximos.tipo_venda = v;
    mudar({ playbook: { ...playbook, vars: proximos } });
  };

  const abrirEnsinar = () => setParams((p) => {
    const n = new URLSearchParams(p);
    n.set('tela', 'ensinar');
    n.delete('passo');
    return n;
  });

  return (
    <CascaDoPasso numero={5} pendente={pendente} salvando={salvando} erro={erro} aoSalvar={() => void salvar()} aoDescartar={descartar}>
      <Secao titulo="Venda e locação" descricao="O tipo de venda muda como ela conduz a conversa e como chama o que vocês vendem.">
        <Campo id="p5-tipo" rotulo="Tipo de venda">
          <Seletor id="p5-tipo" className={`${CLASSE_DO_CAMPO} w-full`} value={tipo} onChange={(e) => trocarTipo(e.target.value)}>
            {Object.entries(TIPO_DE_VENDA_ROTULOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </Seletor>
        </Campo>
        <Caixa id="p5-locacao" rotulo="Também atende locação" descricao="Desmarque se a imobiliária só vende: ela redireciona quem procura aluguel."
          marcada={rascunho.locacao_enabled !== false} aoMudar={(v) => mudar({ locacao_enabled: v })} />
      </Secao>

      <Secao titulo="Imóvel padrão" descricao="Pra IA de um empreendimento só: ela sempre fala deste imóvel, mesmo sem código na mensagem.">
        <Campo id="p5-imovel" rotulo="Imóvel padrão">
          <Seletor id="p5-imovel" className={`${CLASSE_DO_CAMPO} w-full`} value={codigo}
            onChange={(e) => mudar({ default_property_code: e.target.value || null })}>
            <option value="">Nenhum: ela descobre pelo anúncio</option>
            {codigoForaDaLista && <option value={codigo}>{codigo} (não está entre os ativos)</option>}
            {imoveis.map((i) => <option key={i.code} value={i.code}>{i.code} · {i.title}</option>)}
          </Seletor>
        </Campo>
      </Secao>

      <Secao titulo="Imóveis do cadastro" descricao="O que ela pode buscar e mandar dos imóveis cadastrados.">
        <Caixa id="p5-catalogo" rotulo="Consultar o cadastro de imóveis" marcada={rascunho.catalog_search_enabled !== false}
          aoMudar={(v) => mudar({ catalog_search_enabled: v })} />
        <Caixa id="p5-outras" rotulo="Oferecer outras opções quando o imóvel não servir" marcada={rascunho.cross_sell_enabled !== false}
          aoMudar={(v) => mudar({ cross_sell_enabled: v })} />
        <Caixa id="p5-midia" rotulo="Mandar fotos e vídeo do imóvel" marcada={rascunho.rich_media_enabled !== false}
          aoMudar={(v) => mudar({ rich_media_enabled: v })} />
      </Secao>

      <Secao titulo="Book do imóvel" descricao="O book cadastrado no imóvel, sem precisar subir o arquivo de novo.">
        <Caixa id="p5-book" rotulo="Mandar o book do imóvel" marcada={rascunho.send_property_book_enabled !== false}
          aoMudar={(v) => mudar({ send_property_book_enabled: v })} />
        {rascunho.send_property_book_enabled !== false && (
          <CampoTextoLongo id="p5-book-regra" rotulo="Quando ela pode mandar o book" rows={2} valor={rascunho.book_send_rule ?? ''}
            placeholder={REGRA_PADRAO_DO_BOOK} ajuda="Vazio: só quando o lead pede."
            aoMudar={(v) => mudar({ book_send_rule: v.trim() ? v : null })} />
        )}
      </Secao>

      <Secao titulo="O que ela sabe" descricao="Arquivos, textos e regras que ela consulta pra responder ficam em Ensinar.">
        <Button type="button" variant="outline" onClick={abrirEnsinar}>Abrir Ensinar</Button>
      </Secao>
    </CascaDoPasso>
  );
}
