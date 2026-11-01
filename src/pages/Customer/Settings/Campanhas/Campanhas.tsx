// Configurações > Campanhas (Tarefa 77, 01/11/2026; era "Formulários do Meta"). Duas partes numa lista só:
// Formulários do Meta (as fichas de sempre, que ganharam "o que vende", a condição e qual IA atende) e Anúncios de
// WhatsApp (as linhas `campaign_links`). A lista vem do servidor (`GET /campaigns`); campanha nova aparece sozinha.
// Quem vê: a chave da lista (`campaign_links.read` ou a antiga `lead_ads_form_configs.read`). Quem edita cada parte
// é a chave da própria linha. Corretor não tem o item no menu e, se chegar pelo endereço, cai no NoAccessState.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/ds';
import { Pagina, BaseHeader } from '@/components/base';
import EmptyState from '@/components/base/EmptyState';
import Carregando from '@/components/base/Carregando';
import Aviso from '@/components/base/Aviso';
import NoAccessState from '@/components/permissions/NoAccessState';
import LeadAdsForms from '../LeadAdsForms';
import LinhaDaCampanha from './LinhaDaCampanha';
import JanelaDaCampanha from './JanelaDaCampanha';
import { useCan } from '@/hooks/useCan';
import { propertiesService } from '@/services/properties/propertiesService';
import { campanhasService, type ItemDeCampanha, type OpcaoDeIa } from '@/services/campanhas/campanhasService';
import { semOfertaComLeadRecente } from '@/features/campanhas/itensDeCampanha';

const SUBTITULO = 'Tudo o que trouxe lead pro LM Flow nos últimos 90 dias. Diga o que cada uma vende: a IA usa isso na conversa. Campanha nova aparece aqui sozinha.';

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

  const carregar = useCallback(async () => {
    try {
      setItens(await campanhasService.lista());
      setErro(false);
    } catch {
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
  // Formulário só sem ficha (descoberto pelos leads) não entra na conta: ele aparece em "Disponíveis no Facebook".
  const semOfertaRecente = useMemo(
    () => semOfertaComLeadRecente((itens ?? []).filter((i) => i.kind !== 'form' || i.form_config_id)),
    [itens],
  );

  if (!podeVer) {
    return (
      <Pagina cabecalho={<BaseHeader title="Campanhas" subtitle={SUBTITULO} />}>
        <NoAccessState />
      </Pagina>
    );
  }

  const aviso = semOfertaRecente.length > 0 && (
    <Aviso tom="atencao" className="mb-6">
      <p>
        <b>{semOfertaRecente.length === 1 ? '1 campanha trouxe lead esta semana e não diz o que vende.' : `${semOfertaRecente.length} campanhas trouxeram lead esta semana e não dizem o que vendem.`}</b>{' '}
        Enquanto isso, a IA segue pelo imóvel principal dela e pergunta o que a pessoa procura.
      </p>
    </Aviso>
  );

  const parteDosAnuncios = (
    <div className="mt-8" data-testid="anuncios-de-whatsapp">
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">Anúncios de WhatsApp</h2>
      <p className="mb-3 text-xs text-muted-foreground">Quem clicou no anúncio e caiu direto no WhatsApp. Diga o que cada um vende.</p>
      {itens === null ? (
        <Carregando linhas={2} rotulo="Carregando os anúncios…" />
      ) : erro && anuncios.length === 0 ? (
        <EmptyState tipo="erro" aoTentarDeNovo={() => void carregar()} />
      ) : anuncios.length === 0 ? (
        <EmptyState title="Nenhum anúncio de WhatsApp ainda" description="Quando alguém clicar num anúncio e chamar no WhatsApp, ele aparece aqui sozinho." />
      ) : (
        <div className="space-y-3">
          {anuncios.map((it) => (
            <LinhaDaCampanha key={it.key} item={it} nomes={nomes} podeEditar={podeEditarAnuncio} aoEditar={setAberto} />
          ))}
        </div>
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
    </div>
  );

  return (
    <LeadAdsForms
      titulo="Campanhas"
      subtitulo={SUBTITULO}
      topo={aviso}
      depois={parteDosAnuncios}
      cabecalhoExtra={podeConectar ? (
        <Button asChild variant="outline" size="sm"><Link to="/settings/facebook">Conectar o Meta</Link></Button>
      ) : undefined}
      campanhas={{ itens: itens ?? [], listaPronta: itens !== null && !erro, listaFalhou: erro, opcoesDeIa, nomes, aoMudar: () => void carregar() }}
    />
  );
}
