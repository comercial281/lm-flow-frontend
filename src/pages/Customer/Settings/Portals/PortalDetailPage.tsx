import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Copy } from 'lucide-react';
import { Button, Card } from '@/components/ui/ds';
import { BaseHeader, Pagina } from '@/components/base';
import Abas from '@/components/base/Abas';
import Aviso from '@/components/base/Aviso';
import BaseStatusBadge from '@/components/base/BaseStatusBadge';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { plural, tempoDesde } from '@/lib/formato';
import { portalsService, PortalDetail } from '@/services/portals/portalsService';
import { PortalLogo } from '@/components/portals/PortalLogo';
import { legadoParaPublicacoes, temTiposDeAnuncio } from '@/features/portals/adPlan';
import { situacaoDoPortal } from '@/features/portals/situacao';
import { PEDIDO_SAIR_SEM_SALVAR, temAlteracaoPendente } from '@/hooks/useAlteracoesNaoSalvas';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import PortalPropertiesSelector from './PortalPropertiesSelector';
import PortalAdPlanCard from './PortalAdPlanCard';
import PortalSettingsCard from './PortalSettingsCard';
import PortalConexao from './PortalConexao';

type ChaveDaAba = 'imoveis' | 'plano' | 'configurar' | 'conexao';
const ABAS_VALIDAS: ChaveDaAba[] = ['imoveis', 'plano', 'configurar', 'conexao'];

const voltar = (
  <Link to="/settings/portals" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
    Voltar aos Portais
  </Link>
);

/** Copiar o endereço do feed direto do aviso, sem ir até a aba Conexão. */
function BotaoCopiarFeed({ url }: { url: string }) {
  const copiar = async () => {
    await navigator.clipboard.writeText(url);
    toast.success('Endereço do feed copiado');
  };
  return (
    <Button variant="outline" size="sm" onClick={copiar}>
      <Copy className="h-4 w-4" aria-hidden="true" />
      Copiar endereço do feed
    </Button>
  );
}

// Página de um portal (redesenho de 12/10/2026, opção D): situação no topo, um
// aviso quando o portal não está lendo, e quatro abas — Imóveis (o dia a dia),
// Plano, Configurar e Conexão. Portal não conectado mostra só o passo a passo.
// A aba aberta mora no endereço (`?aba=`), e trocar com alteração pendente pergunta.
export default function PortalDetailPage() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const { portalKey = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const [portal, setPortal] = useState<PortalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [saving, setSaving] = useState(false);
  const carga = useRef(0);

  // O esqueleto só na PRIMEIRA leitura. As abas recarregam a página depois de
  // salvar (`onSaved={carregar}`); trocar tudo pelo esqueleto a cada salvar
  // desmontava as abas, voltava a rolagem para o topo e refazia a busca da
  // carteira inteira no seletor. Na recarga as abas ficam no lugar e
  // ressincronizam pelo que o servidor devolveu.
  const carregar = useCallback(async () => {
    const minha = ++carga.current;
    setErro(false);
    try {
      const detalhe = await portalsService.get(portalKey);
      if (minha === carga.current) setPortal(detalhe);
    } catch {
      if (minha === carga.current) setErro(true);
    } finally {
      if (minha === carga.current) setLoading(false);
    }
  }, [portalKey]);

  // Trocou de portal (a rota mudou): volta ao esqueleto em vez de mostrar as
  // abas do portal anterior sobre a chave nova até a resposta chegar.
  useEffect(() => {
    setPortal(null);
    setLoading(true);
    void carregar();
  }, [carregar]);

  const adTypes = useMemo(() => (temTiposDeAnuncio(portal) ? portal?.ad_types ?? [] : []), [portal]);
  // Servidor novo manda `publications` (imóvel + tipo); o antigo, as duas listas
  // de sempre — que viram o mesmo formato aqui. Memoizado por portal: o seletor
  // reinicia o estado quando esta lista muda de identidade.
  const publications = useMemo(() => {
    if (!portal) return [];
    if (Array.isArray(portal.publications)) return portal.publications;
    return legadoParaPublicacoes(portal.property_ids ?? [], portal.featured_property_ids ?? [], adTypes);
  }, [portal, adTypes]);

  const temPlano = adTypes.length > 0;
  const pedida = params.get('aba') as ChaveDaAba | null;
  const aba: ChaveDaAba = pedida && ABAS_VALIDAS.includes(pedida) && (pedida !== 'plano' || temPlano) ? pedida : 'imoveis';

  const trocarAba = async (nova: string) => {
    if (nova === aba) return;
    // A aba que sai é desmontada (e leva a alteração junto): pergunta antes, como o menu.
    if (temAlteracaoPendente() && !(await confirmar(PEDIDO_SAIR_SEM_SALVAR))) return;
    setParams(prev => {
      const proximo = new URLSearchParams(prev);
      if (nova === 'imoveis') proximo.delete('aba'); else proximo.set('aba', nova);
      return proximo;
    }, { replace: true });
  };

  const handleConnect = async () => {
    if (!portal) return;
    setSaving(true);
    try {
      // Pela porta de Portais (`portals.update`): quem abre Portais liga o
      // portal sem precisar das outras integrações da conta.
      await portalsService.connect(portal.portal_key);
      toast.success(`${portal.name} conectado`);
      await carregar();
    } catch {
      toast.error('Erro ao conectar portal');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!portal?.integration_id) return;
    if (!(await confirmar({
      titulo: `Desconectar ${portal.name}?`,
      descricao: 'O portal deixa de receber seus imóveis: o endereço do feed para de responder. A configuração e o plano ficam guardados para quando conectar de novo.',
      rotuloDaAcao: 'Desconectar',
      destrutivo: true,
    }))) return;
    setSaving(true);
    try {
      await portalsService.disconnect(portal.portal_key);
      toast.success(`${portal.name} desconectado`);
      await carregar();
    } catch {
      toast.error('Erro ao desconectar portal');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!(await confirmar({
      titulo: 'Rotacionar a chave',
      descricao: 'Isso invalida o endereço atual do feed — será preciso atualizar no painel do portal.',
      rotuloDaAcao: 'Rotacionar',
      destrutivo: true,
    }))) return;
    try {
      await portalsService.regenerateToken(portalKey);
      toast.success('Chave rotacionada — atualize o endereço no painel do portal');
      await carregar();
    } catch {
      toast.error('Erro ao rotacionar a chave');
    }
  };

  if (loading || (!portal && !erro)) {
    return (
      <Pagina acima={voltar} cabecalho={<BaseHeader title="Portal" />}>
        <Carregando linhas={4} rotulo="Carregando portal…" />
      </Pagina>
    );
  }

  if (!portal) {
    return (
      <Pagina acima={voltar} cabecalho={<BaseHeader title="Portal" />}>
        <EmptyState tipo="erro" aoTentarDeNovo={() => { setLoading(true); void carregar(); }} />
      </Pagina>
    );
  }

  const situacao = situacaoDoPortal(portal);
  const subtitulo = portal.connected
    ? `${situacao.detalhe} · ${plural(portal.sent_count, 'imóvel', 'imóveis')} no portal`
    : 'Conecte pra começar a mandar seus imóveis.';

  const abas = [
    { chave: 'imoveis', rotulo: 'Imóveis', contagem: portal.sent_count },
    ...(temPlano ? [{ chave: 'plano', rotulo: 'Plano' }] : []),
    { chave: 'configurar', rotulo: 'Configurar' },
    { chave: 'conexao', rotulo: 'Conexão' },
  ];

  return (
    <>
      <Pagina
        acima={voltar}
        cabecalho={
          <BaseHeader
            title={
              <span className="inline-flex flex-wrap items-center gap-2">
                {portal.name}
                <BaseStatusBadge status={situacao.selo} text={situacao.rotulo} />
              </span>
            }
            subtitle={subtitulo}
          />
        }
      >
        <div className="flex items-center gap-4">
          <PortalLogo portalKey={portal.portal_key} className="w-14 h-14" />
        </div>

        {!portal.connected ? (
          <Card className="max-w-3xl gap-5 p-6">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Como conectar</h2>
              <p className="text-sm text-muted-foreground">
                Você contrata o plano com o portal; o LM Flow cria o endereço com seus imóveis e o que recebe os leads.
              </p>
            </div>
            <ol className="ml-4 list-decimal space-y-2 text-sm text-muted-foreground">
              {portal.onboarding.map((passo, i) => <li key={i}>{passo}</li>)}
            </ol>
            {portal.integration_status === 'adapted' && (
              <Aviso tom="atencao" titulo="Formato a confirmar." compacto>
                {portal.status_note ?? 'Confirme com o portal antes do primeiro envio.'}
              </Aviso>
            )}
            <div>
              <Button onClick={handleConnect} disabled={saving}>
                {saving ? 'Conectando…' : `Conectar ${portal.name}`}
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {situacao.chave === 'parou' && (
              <Aviso
                tom="erro"
                titulo={`O portal não lê o seu feed ${tempoDesde(portal.last_accessed_at ?? '')}.`}
                acao={portal.feed_url ? <BotaoCopiarFeed url={portal.feed_url} /> : undefined}
              >
                Os anúncios param de atualizar no portal. Confira no painel do portal se o endereço do feed continua cadastrado.
              </Aviso>
            )}
            {situacao.chave === 'esperando' && (
              <Aviso
                tom="atencao"
                titulo="O portal ainda não leu o seu feed."
                acao={portal.feed_url ? <BotaoCopiarFeed url={portal.feed_url} /> : undefined}
              >
                Confira se o endereço do feed está cadastrado no painel do portal. Depois disso, ele costuma ler algumas vezes por dia.
              </Aviso>
            )}

            <Abas rotulo={`Seções de ${portal.name}`} abas={abas} ativa={aba} aoTrocar={trocarAba} />

            {aba === 'imoveis' && (
              <PortalPropertiesSelector
                portalKey={portal.portal_key}
                adTypes={adTypes}
                initialPublications={publications}
                supportsHighlight={portal.capabilities.includes('highlight')}
                onSaved={carregar}
              />
            )}
            {aba === 'plano' && temPlano && (
              <PortalAdPlanCard
                portalKey={portal.portal_key}
                adTypes={adTypes}
                settings={portal.settings}
                onSaved={carregar}
              />
            )}
            {aba === 'configurar' && (
              <PortalSettingsCard portalKey={portal.portal_key} settings={portal.settings} onSaved={carregar} />
            )}
            {aba === 'conexao' && (
              <PortalConexao
                portal={portal}
                aoRotacionar={handleRegenerateToken}
                aoDesconectar={handleDisconnect}
                desconectando={saving}
              />
            )}
          </>
        )}
      </Pagina>
      {dialogoDeConfirmacao}
    </>
  );
}
