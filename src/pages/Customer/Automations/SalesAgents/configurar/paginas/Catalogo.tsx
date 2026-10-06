// Conversa · Catálogo (onda 3). Tipo de venda em botões + chave Locação, imóvel
// padrão, e as 4 coisas do cadastro que ela pode usar (cada uma com chave). O
// tipo "Lançamento" é o padrão de fábrica: gravá-lo apaga a chave (`tipo_venda`
// ausente), como sempre foi. "O que ela sabe" (arquivos) é do Ensinar.
import { useEffect, useState } from 'react';
import { Secao, Secoes } from '@/components/base/Secao';
import { Campo, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import LinhaComChave from '@/components/base/LinhaComChave';
import type { PlaybookVars, SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { propertiesService } from '@/services/properties/propertiesService';
import { TIPO_DE_VENDA_PADRAO } from '@/features/salesAgents/rotulosDaIa';
import TextoNaHora from '../TextoNaHora';
import type { PropsDaPagina } from '../paginas';

const TIPOS = [
  { valor: 'lancamento', rotulo: 'Lançamento' },
  { valor: 'usado', rotulo: 'Usado ou pronto' },
  { valor: 'loteamento', rotulo: 'Loteamento' },
  { valor: 'locacao', rotulo: 'Locação' },
  { valor: 'misto', rotulo: 'Misto' },
];
const REGRA_PADRAO_DO_BOOK = 'o lead pedir o book, a apresentação completa, o material ou mais detalhes do empreendimento';

export default function Catalogo({ agent, gravar }: PropsDaPagina) {
  // null = a lista ainda não chegou (ou falhou): aí não dá pra dizer que o código
  // salvo está "fora dos ativos" — ele aparece sozinho, sem o aviso.
  const [imoveis, setImoveis] = useState<{ code: string; title: string }[] | null>(null);
  useEffect(() => {
    let vivo = true;
    propertiesService.list({ status: 'active', per_page: 100 })
      .then((res) => { if (vivo) setImoveis((res.data ?? []).map((p) => ({ code: p.code, title: p.title }))); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  const playbook = agent.playbook ?? {};
  const vars = (playbook.vars ?? {}) as PlaybookVars;
  const tipo = vars.tipo_venda || TIPO_DE_VENDA_PADRAO;
  const codigo = agent.default_property_code ?? '';
  const naLista = !!codigo && !!imoveis?.some((i) => i.code === codigo);

  const trocarTipo = (v: string) => {
    const proximos: PlaybookVars = { ...vars, tipo_venda: v === TIPO_DE_VENDA_PADRAO ? undefined : v };
    return gravar({ playbook: { ...playbook, vars: proximos } }, ['playbook.vars.tipo_venda']);
  };

  // `!== false`: ausente = ligado (padrão de fábrica), como o servidor.
  const QUADROS: { rotulo: string; descricao: string; ligada: boolean; mudar: (v: boolean) => Partial<SalesAgent> }[] = [
    { rotulo: 'Consultar o cadastro', descricao: 'Busca imóveis cadastrados pra responder.', ligada: agent.catalog_search_enabled !== false, mudar: (v) => ({ catalog_search_enabled: v }) },
    { rotulo: 'Oferecer outras opções', descricao: 'Quando o imóvel do anúncio não serve.', ligada: agent.cross_sell_enabled !== false, mudar: (v) => ({ cross_sell_enabled: v }) },
    { rotulo: 'Fotos e vídeo', descricao: 'Manda as fotos e o vídeo do imóvel.', ligada: agent.rich_media_enabled !== false, mudar: (v) => ({ rich_media_enabled: v }) },
  ];

  return (
    <Secoes>
      <Secao titulo="Tipo de venda" descricao="Muda como ela conduz e como chama o que vocês vendem.">
        <BotoesDeEscolha rotulo="Tipo de venda" valor={tipo} opcoes={TIPOS} aoEscolher={(v) => void trocarTipo(v)} />
        <LinhaComChave rotulo="Também atende locação" descricao="Desligado: quem procura aluguel é redirecionado."
          ligada={agent.locacao_enabled !== false} aoMudar={(v) => gravar({ locacao_enabled: v })} />
      </Secao>

      <Secao titulo="Imóvel padrão" descricao="Pra IA de um empreendimento só: ela sempre fala dele, mesmo sem código na mensagem.">
        <Campo id="catalogo-imovel" rotulo="Imóvel padrão">
          <Seletor id="catalogo-imovel" className={`${CLASSE_DO_CAMPO} w-full`} value={codigo}
            onChange={(e) => void gravar({ default_property_code: e.target.value || null })}>
            <option value="">Nenhum: ela descobre pelo anúncio</option>
            {codigo && !naLista && <option value={codigo}>{imoveis ? `${codigo} (não está entre os ativos)` : codigo}</option>}
            {(imoveis ?? []).map((i) => <option key={i.code} value={i.code}>{i.code} · {i.title}</option>)}
          </Seletor>
        </Campo>
      </Secao>

      <Secao titulo="O que ela pode usar" descricao="Do cadastro de imóveis. Arquivos próprios ficam em Ensinar.">
        <div className="grid gap-3 md:grid-cols-2">
          {QUADROS.map((q) => (
            <div key={q.rotulo} className="rounded-2xl border-[1.5px] border-border bg-background p-3.5">
              <LinhaComChave rotulo={q.rotulo} descricao={q.descricao} ligada={q.ligada} aoMudar={(v) => gravar(q.mudar(v))} />
            </div>
          ))}
          <div className="rounded-2xl border-[1.5px] border-border bg-background p-3.5">
            <LinhaComChave rotulo="Book do imóvel" descricao="O book cadastrado, sem subir de novo."
              ligada={agent.send_property_book_enabled !== false} aoMudar={(v) => gravar({ send_property_book_enabled: v })}>
              <TextoNaHora id="catalogo-book" tipo="varias" rows={2} rotulo="Quando ela pode mandar o book" salvo={agent.book_send_rule ?? ''}
                placeholder={REGRA_PADRAO_DO_BOOK} ajuda="Vazio: só quando o lead pede." aoGravar={(v) => gravar({ book_send_rule: v.trim() ? v : null })} />
            </LinhaComChave>
          </div>
        </div>
      </Secao>
    </Secoes>
  );
}
