// Página de fotos e vídeos do imóvel (12/10/2026; era a janela da lista e do
// cadastro). Spec: LM FLOW/specs/2026-10-12-pagina-de-fotos-design.md.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Abas from '@/components/base/Abas';
import { BaseHeader, Carregando, EmptyState, Pagina } from '@/components/base';
import NoAccessState from '@/components/permissions/NoAccessState';
import { useNomeDaAba } from '@/components/layout/nomeDaAba';
import { isForbiddenError } from '@/services/core/forbidden';
import { propertiesService, type Property } from '@/services/properties/propertiesService';
import { tipoDoImovel } from '@/features/properties/listingKind';
import { useFotosDoImovel } from '@/features/properties/fotos/useFotosDoImovel';
import { usePermissoesDasFotos } from '@/features/properties/fotos/usePermissoesDasFotos';
import {
  contagens, daAba, destinoDaVolta, separar, type AbaDasFotos,
} from '@/features/properties/fotos/regrasDasFotos';
import CartaoDaCapa from './CartaoDaCapa';

const ROTULO_DA_ABA: Record<AbaDasFotos, string> = {
  tudo: 'Tudo', fotos: 'Fotos', midias: 'Vídeos e áudios', ocultas: 'Ocultas',
};

export default function FotosDoImovel() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const pode = usePermissoesDasFotos();
  const dados = useFotosDoImovel(id);
  const [imovel, setImovel] = useState<Property | null>(null);
  const [semAcesso, setSemAcesso] = useState(false);
  const [aba, setAba] = useState<AbaDasFotos>('tudo');

  useNomeDaAba(imovel ? (imovel.code || imovel.title) : null);

  useEffect(() => {
    let vivo = true;
    propertiesService.get(id)
      .then(p => { if (vivo) setImovel(p); })
      .catch(e => { if (vivo && isForbiddenError(e)) setSemAcesso(true); });
    return () => { vivo = false; };
  }, [id]);

  if (semAcesso) return <NoAccessState />;

  const volta = destinoDaVolta({
    id,
    de: sp.get('de'),
    kind: imovel ? tipoDoImovel(imovel) : 'resale',
    temHistorico: location.key !== 'default',
  });
  const voltar = (
    <Link
      to={volta.para === -1 ? '/properties' : volta.para}
      onClick={e => { if (volta.para === -1) { e.preventDefault(); navigate(-1); } }}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />{volta.rotulo}
    </Link>
  );

  const total = contagens(dados.fotos);
  const visiveis = daAba(separar(dados.fotos), aba);
  const capa = dados.fotos.find(p => p.id === dados.capaId) ?? null;
  const subtitulo = imovel ? [imovel.code, imovel.title].filter(Boolean).join(' · ') : undefined;

  return (
    <Pagina
      rolagem="conteudo"
      acima={voltar}
      cabecalho={<BaseHeader title="Fotos e vídeos" subtitle={subtitulo} />}
    >
      <div className="flex-1 overflow-auto pb-24">
        {dados.carregando && !dados.fotos.length ? (
          <Carregando variante="cartoes" linhas={3} rotulo="Carregando fotos..." />
        ) : dados.erro ? (
          <EmptyState tipo="erro" aoTentarDeNovo={() => void dados.carregar()} />
        ) : !dados.fotos.length ? (
          <EmptyState
            title="Nenhuma foto ainda"
            description={pode.subir ? 'Arraste fotos e vídeos para esta página ou use "Adicionar fotos e vídeos".' : 'Quem cuida dos imóveis na sua imobiliária adiciona as fotos.'}
          />
        ) : (
          <>
            <Abas
              rotulo="O que mostrar"
              ativa={aba}
              aoTrocar={c => setAba(c as AbaDasFotos)}
              abas={(Object.keys(ROTULO_DA_ABA) as AbaDasFotos[]).map(chave => ({
                chave, rotulo: ROTULO_DA_ABA[chave], contagem: total[chave],
              }))}
              className="mb-5"
            />
            <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
              <CartaoDaCapa capa={capa} />
              <div className="flex min-w-0 flex-col gap-8">
                {/* Task 4: <GradeDeFotos/> · Task 5: <ListaDeMidias/> */}
                <span hidden>{visiveis.imagens.length + visiveis.midias.length}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </Pagina>
  );
}
