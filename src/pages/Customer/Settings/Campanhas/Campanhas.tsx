// Configurações > Campanhas (Tarefa 77, 01/11/2026; era "Formulários do Meta"). Duas partes numa lista só:
// Formulários do Meta (as fichas de sempre, que ganharam "o que vende", a condição e qual IA atende) e Anúncios de
// WhatsApp (as linhas `campaign_links`). A lista vem do servidor (`GET /campaigns`); campanha nova aparece sozinha.
// Quem vê: a chave da lista (`campaign_links.read` ou a antiga `lead_ads_form_configs.read`). Quem edita cada parte
// é a chave da própria linha. Corretor não tem o item no menu e, se chegar pelo endereço, cai no NoAccessState.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/ds';
import { Pagina, BaseHeader } from '@/components/base';
import EmptyState from '@/components/base/EmptyState';
import Carregando from '@/components/base/Carregando';
import NoAccessState from '@/components/permissions/NoAccessState';
import LeadAdsForms from '../LeadAdsForms';
import TabelaDeAnuncios from './TabelaDeAnuncios';
import JanelaDaCampanha from './JanelaDaCampanha';
import { useCan } from '@/hooks/useCan';
import { propertiesService } from '@/services/properties/propertiesService';
import { campanhasService, type ItemDeCampanha, type OpcaoDeIa } from '@/services/campanhas/campanhasService';

const SUBTITULO = 'Tudo o que trouxe lead pro LM Flow nos últimos 90 dias.';

export default function Campanhas() {
  const can = useCan();
  const podeVer = can('lead_ads_form_configs', 'read') || can('campaign_links', 'read');
  const podeEditarAnuncio = can('campaign_links', 'update');
  const podeConectar = can('lead_ads_form_configs', 'delete');

  const [itens, setItens] = useState<ItemDeCampanha[] | null>(null);
  const [erro, setErro] = useState(false);
  const [opcoesDeIa, setOpcoesDeIa] = useState<OpcaoDeIa[] | undefined>(undefined);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [aberto, setAberto] = useState<ItemDeCampanha | null>(null);

  // Só a leitura mais nova vale: uma resposta lenta de antes (ex.: a da abertura) não sobrescreve a de depois de um Criar ou Salvar.
  const leitura = useRef(0);
  const carregar = useCallback(async () => {
    const minha = ++leitura.current;
    try {
      const lista = await campanhasService.lista();
      if (minha !== leitura.current) return;
      setItens(lista);
      setErro(false);
    } catch {
      if (minha !== leitura.current) return;
      setErro(true);
      setItens((atual) => atual ?? []);
    }
  }, []);

  useEffect(() => { if (podeVer) void carregar(); }, [podeVer, carregar]);

  // As opções de "qual IA atende" vêm do servidor. Sem elas (servidor sem a rota), o bloco some da janela.
  useEffect(() => {
    if (!podeVer) return;
    let vivo = true;
    campanhasService.opcoesDeIa().then((o) => { if (vivo) setOpcoesDeIa(o); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [podeVer]);

  // Nomes dos imóveis que as campanhas vendem (leitura de fundo; falhou: a linha só conta quantos).
  const temImoveis = (itens ?? []).some((i) => i.sells_scope === 'properties' && i.property_ids.length > 0);
  useEffect(() => {
    if (!temImoveis) return;
    let vivo = true;
    (async () => {
      const achados: Record<string, string> = {};
      try {
        const r = await propertiesService.list({ per_page: 100 });
        (r.data ?? []).forEach((p) => { achados[String(p.id)] = p.title; });
      } catch { /* sem nomes: a linha só conta */ }
      // Imóvel fora dos 100 primeiros: busca pelo id os nomes que faltam.
      const faltam = [...new Set((itens ?? []).flatMap((i) => (i.sells_scope === 'properties' ? i.property_ids.map(String) : [])))]
        .filter((id) => !achados[id]).slice(0, 30);
      await Promise.all(faltam.map((id) => propertiesService.get(id).then((p) => { if (p?.title) achados[id] = p.title; }).catch(() => undefined)));
      if (vivo) setNomes(achados);
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temImoveis]);

  const anuncios = useMemo(() => (itens ?? []).filter((i) => i.kind !== 'form'), [itens]);

  if (!podeVer) {
    return (
      <Pagina cabecalho={<BaseHeader title="Campanhas" subtitle={SUBTITULO} />}>
        <NoAccessState />
      </Pagina>
    );
  }

  const parteDosAnuncios = (
    <section className="mt-8" data-testid="anuncios-de-whatsapp" aria-labelledby="anuncios-de-whatsapp-titulo">
      <h2 id="anuncios-de-whatsapp-titulo" className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">Anúncios de WhatsApp</h2>
      <p className="mb-3 text-xs text-muted-foreground">Quem clicou no anúncio e caiu direto no WhatsApp. Dizer o que cada um oferece é opcional: a IA usa isso na conversa.</p>
      {itens === null ? (
        <Carregando linhas={2} rotulo="Carregando os anúncios…" />
      ) : erro && anuncios.length === 0 ? (
        <EmptyState tipo="erro" aoTentarDeNovo={() => void carregar()} />
      ) : anuncios.length === 0 ? (
        <EmptyState tamanho="compacto" title="Nenhum anúncio de WhatsApp ainda" description="Quando alguém clicar num anúncio e chamar no WhatsApp, ele aparece aqui sozinho." />
      ) : (
        <TabelaDeAnuncios itens={anuncios} nomes={nomes} podeEditar={podeEditarAnuncio} aoAbrir={setAberto} />
      )}
      {aberto && (
        <JanelaDaCampanha
          key={aberto.key}
          tipo="whats"
          item={aberto}
          opcoesDeIa={opcoesDeIa}
          aoFechar={() => setAberto(null)}
          aoSalvar={() => void carregar()}
          aoCriarLinha={(it, id) => setItens((l) => (l ?? []).map((x) => (x.key === it.key ? { ...x, link_id: id } : x)))}
          aoMudarIa={(it, donos) => setItens((l) => (l ?? []).map((x) => (x.key === it.key ? { ...x, agents: donos } : x)))}
        />
      )}
    </section>
  );

  return (
    <LeadAdsForms
      titulo="Campanhas"
      subtitulo={SUBTITULO}
      depois={parteDosAnuncios}
      cabecalhoExtra={podeConectar ? (
        <Button asChild variant="outline" size="sm"><Link to="/settings/facebook">Conectar o Meta</Link></Button>
      ) : undefined}
      campanhas={{ itens: itens ?? [], listaPronta: itens !== null && !erro, listaFalhou: erro, opcoesDeIa, nomes, aoMudar: () => void carregar() }}
    />
  );
}
