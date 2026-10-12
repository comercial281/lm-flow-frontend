// Página de fotos e vídeos do imóvel (12/10/2026; era a janela da lista e do
// cadastro). Spec: LM FLOW/specs/2026-10-12-pagina-de-fotos-design.md.
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckSquare, Eye, EyeOff, Link as LinkIcon, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import Abas from '@/components/base/Abas';
import { Aviso, BaseHeader, Carregando, EmptyState, Pagina } from '@/components/base';
import NoAccessState from '@/components/permissions/NoAccessState';
import { useNomeDaAba } from '@/components/layout/nomeDaAba';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { cn } from '@/lib/utils';
import { plural } from '@/lib/formato';
import { ACCEPTED_MIME_TYPES } from '@/services/propertyPhotos/propertyPhotosService';
import { isForbiddenError } from '@/services/core/forbidden';
import { propertiesService, type Property } from '@/services/properties/propertiesService';
import { tipoDoImovel } from '@/features/properties/listingKind';
import { useFotosDoImovel } from '@/features/properties/fotos/useFotosDoImovel';
import { usePermissoesDasFotos } from '@/features/properties/fotos/usePermissoesDasFotos';
import {
  contagens, daAba, destinoDaVolta, separar, type AbaDasFotos,
} from '@/features/properties/fotos/regrasDasFotos';
import CartaoDaCapa from './CartaoDaCapa';
import GradeDeFotos from './GradeDeFotos';
import ListaDeMidias from './ListaDeMidias';
import JanelaPorEndereco from './JanelaPorEndereco';

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
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const campoDeArquivo = useRef<HTMLInputElement>(null);
  const [porEndereco, setPorEndereco] = useState(false);
  const [soltando, setSoltando] = useState(false);
  // A Task 7 usa a ampliada:
  const [selecionando, setSelecionando] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [ampliada, setAmpliada] = useState<string | null>(null);
  void ampliada; // até a Task 7 ler

  const alternarSelecao = (fid: string) => setSelecionadas(prev => {
    const nova = new Set(prev);
    if (nova.has(fid)) nova.delete(fid); else nova.add(fid);
    return nova;
  });

  const excluirUma = async (fid: string) => {
    const ehMidia = dados.fotos.find(p => p.id === fid)?.content_type?.match(/^(video|audio)\//);
    if (!(await confirmar({
      titulo: ehMidia ? 'Excluir este arquivo?' : 'Excluir esta foto?',
      descricao: 'Sai do site, dos portais e da IA. Não dá para desfazer.',
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    }))) return;
    await dados.excluir(fid);
  };

  const sairDaSelecao = () => { setSelecionando(false); setSelecionadas(new Set()); };

  const loteDe = async (acao: 'ocultar' | 'mostrar' | 'excluir') => {
    const ids = [...selecionadas];
    if (!ids.length) return;
    if (acao === 'excluir' && !(await confirmar({
      titulo: `Excluir ${plural(ids.length, 'item', 'itens')}?`,
      descricao: 'Saem do site, dos portais e da IA. Não dá para desfazer.',
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    }))) return;
    const r = await dados.emLote(ids, acao);
    const feito = { ocultar: r.feitos === 1 ? 'oculta' : 'ocultas', mostrar: r.feitos === 1 ? 'visível' : 'visíveis', excluir: r.feitos === 1 ? 'excluída' : 'excluídas' }[acao];
    const partes = [`${r.feitos} ${feito}.`];
    if (r.pulouCapa) partes.push('A capa não foi ocultada.');
    if (r.falhas) partes.push(`${r.falhas} não deu certo. Tente de novo.`);
    (r.falhas ? toast.error : toast.success)(partes.join(' '));
    sairDaSelecao();
  };

  const temArquivos = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  const aoArrastarPorCima = (e: DragEvent) => {
    if (!pode.subir || !temArquivos(e)) return;
    e.preventDefault();
    setSoltando(true);
  };
  const aoSoltarArquivos = (e: DragEvent) => {
    if (!pode.subir || !temArquivos(e)) return;
    e.preventDefault();
    setSoltando(false);
    void dados.enviar(Array.from(e.dataTransfer.files));
  };

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
      cabecalho={
        <BaseHeader
          title="Fotos e vídeos"
          subtitle={subtitulo}
          primaryAction={{
            label: 'Adicionar fotos e vídeos',
            icon: <Plus className="h-4 w-4" />,
            onClick: () => campoDeArquivo.current?.click(),
            show: pode.subir,
            disabled: dados.enviando !== null,
          }}
          moreActions={pode.porEndereco ? [{
            label: 'Adicionar por endereço da internet',
            icon: <LinkIcon className="h-4 w-4" />,
            onClick: () => setPorEndereco(true),
          }] : []}
          secondaryActions={(pode.ocultar || pode.excluir) && dados.fotos.length ? [{
            label: selecionando ? 'Concluir seleção' : 'Selecionar',
            icon: <CheckSquare className="h-4 w-4" />,
            onClick: () => (selecionando ? sairDaSelecao() : setSelecionando(true)),
          }] : []}
          selectedCount={selecionadas.size}
          onClearSelection={sairDaSelecao}
          bulkActions={[
            ...(pode.ocultar ? [
              { label: 'Mostrar', icon: <Eye className="h-4 w-4" />, onClick: () => void loteDe('mostrar') },
              { label: 'Ocultar', icon: <EyeOff className="h-4 w-4" />, onClick: () => void loteDe('ocultar') },
            ] : []),
            ...(pode.excluir ? [{ label: 'Excluir', icon: <Trash2 className="h-4 w-4" />, onClick: () => void loteDe('excluir'), variant: 'destructive' as const }] : []),
          ]}
        />
      }
    >
      <div
        className={cn('flex-1 overflow-auto pb-24', soltando && 'rounded-xl ring-2 ring-primary ring-offset-2')}
        onDragOver={aoArrastarPorCima}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSoltando(false); }}
        onDrop={aoSoltarArquivos}
      >
        {pode.subir && (
          <input
            ref={campoDeArquivo}
            type="file"
            multiple
            accept={ACCEPTED_MIME_TYPES.join(',')}
            aria-label="Escolher fotos e vídeos"
            tabIndex={-1}
            className="sr-only"
            onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) void dados.enviar(fs); }}
          />
        )}
        {soltando && <Aviso tom="info" icone={Upload} className="mb-4">Solte para adicionar ao imóvel</Aviso>}
        {dados.enviando !== null && (
          <Aviso tom="info" icone={Upload} className="mb-4">
            {dados.enviando >= 100 ? 'Guardando os arquivos…' : `Enviando… ${dados.enviando}%`}
          </Aviso>
        )}
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
              aoTrocar={c => { setAba(c as AbaDasFotos); sairDaSelecao(); }}
              abas={(Object.keys(ROTULO_DA_ABA) as AbaDasFotos[]).map(chave => ({
                chave, rotulo: ROTULO_DA_ABA[chave], contagem: total[chave],
              }))}
              className="mb-5"
            />
            <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
              <CartaoDaCapa capa={capa} />
              <div className="flex min-w-0 flex-col gap-8">
                {visiveis.imagens.length > 0 && (
                  <section aria-labelledby="titulo-fotos" className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h2 id="titulo-fotos" className="text-base font-semibold">Fotos</h2>
                      {pode.ordem && aba !== 'ocultas' && (
                        <p className="text-sm text-muted-foreground">Arraste pela alça para mudar a ordem. A primeira foto é sempre a capa.</p>
                      )}
                    </div>
                    <GradeDeFotos
                      fotos={visiveis.imagens}
                      todas={dados.fotos}
                      capaId={dados.capaId}
                      pode={pode}
                      arrastavel={pode.ordem && aba !== 'ocultas'}
                      ocupado={dados.salvandoOrdem}
                      selecionando={selecionando}
                      selecionadas={selecionadas}
                      aoAlternarSelecao={alternarSelecao}
                      aoAbrir={setAmpliada}
                      aoMover={(de, para) => void dados.mover('imagens', de, para)}
                      aoUsarComoCapa={fid => void dados.usarComoCapa(fid)}
                      aoAlternarVisivel={fid => void dados.alternarVisivel(fid)}
                      aoExcluir={fid => void excluirUma(fid)}
                    />
                  </section>
                )}
                {visiveis.midias.length > 0 && (
                  <section aria-labelledby="titulo-midias" className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h2 id="titulo-midias" className="text-base font-semibold">Vídeos e áudios</h2>
                      <p className="text-sm text-muted-foreground">Aparecem no site depois das fotos. Vídeo e áudio nunca viram capa.</p>
                    </div>
                    <ListaDeMidias
                      midias={visiveis.midias}
                      todasAsMidias={separar(dados.fotos).midias}
                      pode={pode}
                      arrastavel={pode.ordem && aba !== 'ocultas'}
                      ocupado={dados.salvandoOrdem}
                      selecionando={selecionando}
                      selecionadas={selecionadas}
                      aoAlternarSelecao={alternarSelecao}
                      aoMover={(de, para) => void dados.mover('midias', de, para)}
                      aoAlternarVisivel={fid => void dados.alternarVisivel(fid)}
                      aoExcluir={fid => void excluirUma(fid)}
                    />
                  </section>
                )}
                {aba === 'ocultas' && !visiveis.imagens.length && !visiveis.midias.length && (
                  <EmptyState tamanho="compacto" title="Nenhuma foto oculta" />
                )}
              </div>
            </div>
          </>
        )}
      </div>
      <JanelaPorEndereco aberta={porEndereco} aoFechar={() => setPorEndereco(false)} aoAdicionar={dados.adicionarPorEndereco} />
      {dialogoDeConfirmacao}
    </Pagina>
  );
}
