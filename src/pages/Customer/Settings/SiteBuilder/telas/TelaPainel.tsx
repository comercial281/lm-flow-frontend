import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import { Card, Button } from '@/components/ui/ds';
import { EmptyState } from '@/components/base';
import Aviso from '@/components/base/Aviso';
import { useAppDataStore } from '@/store/appDataStore';
import {
  siteBuilderService, type DashboardScope, type Site, type SiteDashboard, type SiteFormData,
} from '@/services/siteBuilder/siteBuilderService';
import { siteReadiness } from '@/features/siteBuilder/siteReadiness';
import type { TelaId } from '@/features/siteBuilder/meuSiteMenu';
import PreencherComIA from './PreencherComIA';
import Numeros from './painel/Numeros';
import ContatosRecentes from './painel/ContatosRecentes';
import { ImoveisVistos, Origens } from './painel/Origens';

interface Props {
  site: Site;
  irPara: (t: TelaId) => void;
  /** Proposta da IA cai no formulário do pai; quem salva é a barra de Salvar. */
  setF: (field: Partial<SiteFormData>) => void;
  podeAnuncios?: boolean;
}

const PERIODOS = [7, 30, 90] as const;

function Esqueleto() {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }} aria-busy="true">
      {[0, 1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
    </div>
  );
}

export default function TelaPainel({ site, irPara, setF, podeAnuncios = false }: Props) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [scope, setScope] = useState<DashboardScope>('site');
  const [dash, setDash] = useState<SiteDashboard | null>(null);
  const [erro, setErro] = useState(false);

  const [tentativa, setTentativa] = useState(0);
  // CRECI da imobiliária (Configurações › Conta): todo anúncio de imóvel precisa
  // do número. Só avisa com a conta carregada, pra não acusar à toa.
  const conta = useAppDataStore(st => st.account);
  const fetchAccount = useAppDataStore(st => st.fetchAccount);
  useEffect(() => { void fetchAccount(); }, [fetchAccount]);
  // Conta guardada antes da mudança (sem a chave) não acusa: o site pode ter o
  // CRECI antigo do Meu site, que o servidor novo já devolve na chave.
  const semCreci = !!conta && 'creci' in conta && !conta.creci;

  useEffect(() => {
    let vivo = true;
    setDash(null);
    setErro(false);
    siteBuilderService.getDashboard(site.id, { period, scope })
      .then(d => { if (vivo) setDash(d); })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [site.id, period, scope, tentativa]);

  // Sem os números carregados não se sabe quantos imóveis estão no ar: o item
  // "imóvel" e a porcentagem só aparecem depois, para não mostrar pendência falsa.
  const pronto = siteReadiness(site, dash?.published_properties ?? 0);
  const itensPronto = dash ? pronto.itens : pronto.itens.filter(i => i.id !== 'imovel');
  const abrirItem = (id: string, tela: TelaId) => (id === 'imovel' ? navigate('/properties') : irPara(tela));

  return (
    <div className="space-y-5">
      {semCreci && (
        <Aviso
          tom="atencao"
          titulo="Seu site está sem CRECI."
          acao={<Button asChild size="sm" variant="outline"><Link to="/settings/account">Preencher</Link></Button>}
        >
          Todo anúncio de imóvel precisa do número.
        </Aviso>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {podeAnuncios && (
          <div className="flex gap-1" role="group" aria-label="O que contar">
            <Button size="sm" variant={scope === 'site' ? 'default' : 'outline'} onClick={() => setScope('site')} aria-pressed={scope === 'site'}>Site</Button>
            <Button size="sm" variant={scope === 'landing' ? 'default' : 'outline'} onClick={() => setScope('landing')} aria-pressed={scope === 'landing'}>Páginas de anúncio</Button>
          </div>
        )}
        <div className="flex gap-1" role="group" aria-label="Período">
          {PERIODOS.map(p => (
            <Button key={p} size="sm" variant={period === p ? 'default' : 'outline'} onClick={() => setPeriod(p)} aria-pressed={period === p}>{p} dias</Button>
          ))}
        </div>
      </div>

      {erro && (
        <EmptyState tipo="erro" title="Não deu para carregar os números do site." aoTentarDeNovo={() => setTentativa(t => t + 1)} className="py-8" />
      )}
      {!erro && !dash && <Esqueleto />}
      {dash && (
        <>
          <Numeros dash={dash} />
          <div className="grid gap-5 lg:grid-cols-2">
            <Origens dash={dash} />
            <ImoveisVistos dash={dash} />
          </div>
        </>
      )}

      <ContatosRecentes siteId={site.id} aoVerTodos={() => irPara('contatos')} />

      <Card className="gap-4 p-5">
        <h2 className="text-base font-semibold">{dash ? `Seu site está ${pronto.percent}% pronto` : 'Seu site'}</h2>
        {dash && (
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pronto.percent}%` }} />
          </div>
        )}
        <ul className="space-y-1">
          {itensPronto.map(i => (
            <li key={i.id}>
              {i.feito ? (
                <span className="flex items-center gap-2 p-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {i.rotulo}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => abrirItem(i.id, i.tela)}
                  className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left text-sm hover:bg-muted"
                >
                  <Circle className="h-4 w-4 text-muted-foreground" /> {i.rotulo}
                </button>
              )}
            </li>
          ))}
        </ul>
        <PreencherComIA site={site} setF={setF} />
      </Card>
    </div>
  );
}
