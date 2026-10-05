// Cadastro de imóvel em página (Fase 4, Imóveis, entrega 3). Era a janela de
// Properties.tsx; os campos são os mesmos, agora em seções por tipo, com
// índice que acompanha a rolagem e barra fixa embaixo.
//   /properties/new?tipo=empreendimento|revenda   criar
//   /properties/:id/editar[?de=lote]               editar (do lote, volta para ele)
// Quais seções cada tipo tem mora em `secoesDoCadastro`; a validação e o que
// vai para o servidor, em `formularioDoCadastro`.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { propertiesService, type Property, type PropertyFormData } from '@/services/properties/propertiesService';
import { propertyPhotosService } from '@/services/propertyPhotos/propertyPhotosService';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import { useCan } from '@/hooks/useCan';
import { useAlteracoesNaoSalvas, mesmoConteudo, PEDIDO_SAIR_SEM_SALVAR } from '@/hooks/useAlteracoesNaoSalvas';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { EmptyState } from '@/components/base';
import NoAccessState from '@/components/permissions/NoAccessState';
import { isForbiddenError } from '@/services/core/forbidden';
import { plural } from '@/lib/formato';
import { ABA_NA_URL, tipoDoImovel, type ListingKind } from '@/features/properties/listingKind';
import { formularioNovo } from '@/features/properties/formularioPorTipo';
import { cleanTypologies } from '@/features/properties/typologies';
import { secoesDoCadastro, tipoDaUrl, type SecaoId } from '@/features/properties/cadastro/secoesDoCadastro';
import {
  FORMULARIO_VAZIO,
  errosDoCadastro,
  formularioDoImovel,
  payloadDoCadastro,
  type ErroDoCadastro,
} from '@/features/properties/cadastro/formularioDoCadastro';
import IndiceDoCadastro from './IndiceDoCadastro';
import BarraDoCadastro from './BarraDoCadastro';
import PreencherPorTexto from './PreencherPorTexto';
import { propertiesActionGates } from '../propertiesActionGates';
import type { MudancaDoFormulario } from './secoes/tipos';
import { useSecaoVisivel } from './useSecaoVisivel';
import SecaoBasico from './secoes/SecaoBasico';
import SecaoLocalizacao from './secoes/SecaoLocalizacao';
import SecaoObra from './secoes/SecaoObra';
import SecaoTipologias from './secoes/SecaoTipologias';
import SecaoValores from './secoes/SecaoValores';
import SecaoComposicao from './secoes/SecaoComposicao';
import SecaoDetalhesDaVenda from './secoes/SecaoDetalhesDaVenda';
import SecaoCaracteristicas from './secoes/SecaoCaracteristicas';
import SecaoMidia from './secoes/SecaoMidia';
import SecaoDescricao from './secoes/SecaoDescricao';
import SecaoEquipe from './secoes/SecaoEquipe';
import SecaoDadosInternos from './secoes/SecaoDadosInternos';
import SecaoConstrutora from './secoes/SecaoConstrutora';
import SecaoComissao from './secoes/SecaoComissao';
import SecaoProprietario from './secoes/SecaoProprietario';
import OndeDivulgar from './OndeDivulgar';

// A mensagem real do servidor (ex.: "Valor de venda é obrigatório..."), não um genérico.
function mensagemDoErro(e: unknown, reserva: string): string {
  const err = e as { response?: { data?: { error?: { message?: string }; message?: string } } };
  return err?.response?.data?.error?.message || err?.response?.data?.message || reserva;
}

// Depois de rolar até um erro, o índice fica na seção do erro enquanto a
// rolagem suave anda. Passado esse tempo, a primeira mudança de seção visível
// (a pessoa rolou) devolve o índice ao acompanhamento da rolagem.
const ESPERA_DA_ROLAGEM_MS = 800;

const rolarAte = (secao: SecaoId) =>
  document.getElementById(`secao-${secao}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export default function CadastroDoImovel() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  // Outro imóvel (ou outro tipo, no novo) na mesma rota recomeça a página do zero.
  return <Cadastro key={id ?? `novo-${sp.get('tipo') ?? ''}`} />;
}

function Cadastro() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const canAiDesc = useFeature('properties_ai_description');
  // Cadastrar segue a mesma trava do botão "Novo" da lista: função ligada no cliente e cargo.
  const podeCriar = propertiesActionGates(useFeature('properties_create'), useCan()).create;
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const editandoId = id ?? null;
  const [imovel, setImovel] = useState<Property | null>(null);
  const [erroDeCarga, setErroDeCarga] = useState(false);
  const [recusado, setRecusado] = useState(false);
  const kind: ListingKind = imovel ? tipoDoImovel(imovel) : (tipoDaUrl(sp.get('tipo')) ?? 'resale');
  // ?proprietario=<id> (vindo da Gestão de proprietários) já cria com ele escolhido.
  // Só revenda tem a seção Proprietário.
  const proprietarioDaUrl = !editandoId && kind === 'resale' ? sp.get('proprietario') : null;
  const [form, setForm] = useState<PropertyFormData>(() => ({
    ...FORMULARIO_VAZIO,
    ...formularioNovo(kind),
    ...(proprietarioDaUrl ? { owner_id: proprietarioDaUrl } : {}),
  }));
  const [inicial, setInicial] = useState(form);
  const setF = (patch: MudancaDoFormulario) =>
    setForm(prev => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));

  // Mídias escolhidas na criação: sobem logo depois de criar o imóvel.
  const [arquivos, setArquivos] = useState<File[]>([]);
  // Book (PDF) escolhido na criação: sobe depois de criar, junto das mídias.
  const [book, setBook] = useState<File | null>(null);
  const [enviandoMidia, setEnviandoMidia] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Texto colado no "Preencher a partir de um texto"; o "Gerar com IA" também usa.
  const [texto, setTexto] = useState('');
  const [gerandoDescricao, setGerandoDescricao] = useState(false);

  const pronto = !editandoId || !!imovel;
  const secoes = secoesDoCadastro(kind, { editando: !!editandoId });
  const [secaoComErro, setSecaoComErro] = useState<SecaoId | null>(null);
  const visivel = useSecaoVisivel(pronto ? secoes.map(s => s.id) : []);
  const ativa = secaoComErro ?? visivel;
  const erroMarcadoEm = useRef(0);
  useEffect(() => {
    if (Date.now() - erroMarcadoEm.current > ESPERA_DA_ROLAGEM_MS) setSecaoComErro(null);
  }, [visivel]);

  const temAlteracao = pronto && (!mesmoConteudo(form, inicial) || arquivos.length > 0 || book !== null);
  useAlteracoesNaoSalvas(temAlteracao);

  const carregar = useCallback(() => {
    if (!editandoId) return;
    setErroDeCarga(false);
    propertiesService.get(editandoId)
      .then(p => { setImovel(p); const f = formularioDoImovel(p); setForm(f); setInicial(f); })
      .catch(e => { if (isForbiddenError(e)) setRecusado(true); else setErroDeCarga(true); });
  }, [editandoId]);
  useEffect(() => { carregar(); }, [carregar]);

  // O gerenciador de fotos fechou: relê só o imóvel (contagem de fotos), sem mexer no formulário.
  const releFotos = () => {
    if (!editandoId) return;
    propertiesService.get(editandoId).then(setImovel).catch(() => { /* leitura de fundo */ });
  };

  // "Onde divulgar" grava na hora e devolve só a marca mexida; junta no imóvel que a
  // página já tem (a contagem de fotos, por exemplo, não volta atrás). O Salvar
  // da página não manda mais essas três marcas.
  const aoMudarImovelDivulgado = (patch: Partial<Property>) => setImovel(prev => prev && { ...prev, ...patch });

  // Book subido/removido na edição: junta o imóvel devolvido ao que a página já tem.
  const aoMudarImovel = (p: Property) => setImovel(prev => prev && { ...prev, ...p });

  const voltarParaLista = () => {
    const aba = ABA_NA_URL[kind];
    navigate(sp.get('de') === 'lote' ? `/properties?aba=${aba}&importar=1` : `/properties?aba=${aba}`);
  };

  const irParaErro = ({ secao, mensagem }: ErroDoCadastro) => {
    toast.error(mensagem);
    setSecaoComErro(secao);
    erroMarcadoEm.current = Date.now();
    rolarAte(secao);
  };

  // Linha de tipologia que o corretor adicionou e não preencheu não vai pro
  // backend (ele descartaria de qualquer jeito) — evita gravar planta fantasma.
  const formLimpo = () => ({ ...form, typologies: cleanTypologies(form.typologies) });

  const criar = async (rascunho: boolean) => {
    // Rascunho só exige o título: o servidor aceita rascunho sem preço.
    const erros = errosDoCadastro(form).filter(e => !rascunho || e.secao === 'basico');
    if (erros.length) { irParaErro(erros[0]); return; }
    setSalvando(true);
    try {
      const criado = await propertiesService.create(payloadDoCadastro(formLimpo(), { rascunho }));
      if (arquivos.length) {
        setEnviandoMidia(true);
        try {
          await propertyPhotosService.upload(criado.id, arquivos);
          toast.success(`Imóvel cadastrado com ${plural(arquivos.length, 'mídia', 'mídias')}`);
        } catch {
          toast.warning('Imóvel cadastrado, mas algumas mídias falharam. Reenvie no gerenciador de fotos.');
        } finally {
          setEnviandoMidia(false);
        }
      } else {
        toast.success(rascunho ? 'Rascunho salvo' : 'Imóvel cadastrado');
      }
      if (book) {
        try {
          await propertiesService.uploadBook(criado.id, book);
        } catch {
          toast.warning('Imóvel cadastrado, mas o book não subiu. Suba de novo na edição do imóvel.');
        }
        setBook(null);
      }
      if (rascunho) navigate(`/properties?aba=${ABA_NA_URL[kind]}`);
      else navigate(`/properties/${criado.id}/editar?passo=divulgar`);
    } catch (e) {
      toast.error(mensagemDoErro(e, 'Erro ao salvar imóvel'));
    } finally {
      setSalvando(false);
    }
  };

  const salvar = async () => {
    if (!imovel) return;
    const erros = errosDoCadastro(form);
    if (erros.length) { irParaErro(erros[0]); return; }
    setSalvando(true);
    try {
      // listing_kind só vai na criação: salvar não desfaz um "Mover para…" feito em outro lugar.
      const semTipo: Partial<PropertyFormData> = payloadDoCadastro(formLimpo(), { rascunho: false });
      delete semTipo.listing_kind;
      // Destaque, site e IA são do cartão "Onde divulgar", que grava na hora.
      delete semTipo.featured;
      delete semTipo.published_on_site;
      delete semTipo.ai_enabled;
      await propertiesService.update(imovel.id, semTipo);
      toast.success('Imóvel atualizado');
      voltarParaLista();
    } catch (e) {
      toast.error(mensagemDoErro(e, 'Erro ao salvar imóvel'));
    } finally {
      setSalvando(false);
    }
  };

  const cancelar = async () => {
    if (temAlteracao && !(await confirmar({ ...PEDIDO_SAIR_SEM_SALVAR, rotuloDaAcao: 'Sair' }))) return;
    voltarParaLista();
  };

  // Único ponto que usa IA (consome tokens) — e SÓ quando o corretor clica.
  // Gera a descrição a partir dos campos atuais, usando o texto colado como material.
  const gerarDescricao = async () => {
    setGerandoDescricao(true);
    try {
      const result = await propertiesService.generateDescriptionPreview(form, { text: texto.trim() || undefined });
      setForm(prev => ({
        ...prev,
        description: result.description,
        title: (!prev.title && result.headline) ? result.headline : prev.title,
      }));
      toast.success('Descrição gerada com IA');
    } catch {
      toast.error('Erro ao gerar descrição. Verifique se a chave de IA está configurada.');
    } finally {
      setGerandoDescricao(false);
    }
  };

  if (recusado || (!editandoId && !podeCriar)) return <NoAccessState />;

  const props = { form, setF, editando: imovel };
  const conteudoDa = (secao: SecaoId): ReactNode => {
    switch (secao) {
      case 'basico': return <SecaoBasico {...props} />;
      case 'localizacao': return <SecaoLocalizacao {...props} />;
      case 'obra': return <SecaoObra {...props} />;
      case 'tipologias': return <SecaoTipologias {...props} />;
      case 'valores': return <SecaoValores {...props} />;
      case 'composicao': return <SecaoComposicao {...props} />;
      case 'detalhesVenda': return <SecaoDetalhesDaVenda {...props} />;
      case 'caracteristicas': return <SecaoCaracteristicas {...props} />;
      case 'midia':
        return <SecaoMidia {...props} arquivos={arquivos} aoMudarArquivos={setArquivos} enviando={enviandoMidia || salvando} aoFecharFotos={releFotos}
          book={book} aoMudarBook={setBook} aoMudarImovel={aoMudarImovel} />;
      case 'descricao':
        return <SecaoDescricao {...props} podeGerar={canAiDesc} gerando={gerandoDescricao} aoGerar={gerarDescricao} />;
      case 'equipe': return <SecaoEquipe {...props} />;
      case 'dadosInternos': return <SecaoDadosInternos {...props} />;
      case 'construtora': return <SecaoConstrutora {...props} />;
      case 'comissao': return <SecaoComissao {...props} />;
      case 'proprietario': return <SecaoProprietario {...props} />;
      case 'ondeDivulgar':
        return imovel && <OndeDivulgar imovel={imovel} modo="cartao" aoMudarImovel={aoMudarImovelDivulgado} />;
    }
  };

  // ?passo=divulgar (logo depois de criar): só o "Onde divulgar", sem o formulário.
  const soDivulgar = !!editandoId && sp.get('passo') === 'divulgar';

  const titulo = kind === 'development'
    ? (editandoId ? 'Editar empreendimento' : 'Novo empreendimento')
    : (editandoId ? 'Editar imóvel' : 'Novo imóvel');

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {!pronto ? (
          erroDeCarga ? <EmptyState tipo="erro" aoTentarDeNovo={carregar} /> : (
            <div role="status" className="flex flex-col gap-3">
              <span className="sr-only">Carregando o imóvel</span>
              {[0, 1, 2].map(i => <div key={i} className="h-32 animate-pulse rounded-xl border bg-muted/40" />)}
            </div>
          )
        ) : soDivulgar && imovel ? (
          <div className="mx-auto max-w-2xl">
            <OndeDivulgar imovel={imovel} modo="passo" aoMudarImovel={aoMudarImovelDivulgado} />
          </div>
        ) : (
          <div className="mx-auto max-w-6xl">
            <h1 className="text-2xl font-bold leading-tight">{titulo}</h1>
            <div className="mt-4 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
              <IndiceDoCadastro
                secoes={secoes}
                ativa={ativa}
                aoEscolher={secao => { setSecaoComErro(null); rolarAte(secao); }}
              />
              <div className="mt-4 space-y-4 lg:mt-0">
                {!editandoId && <PreencherPorTexto form={form} setF={setF} texto={texto} aoMudarTexto={setTexto} temBook={!!book} aoEscolherBook={setBook} />}
                {secoes.map(s => (
                  <section key={s.id} id={`secao-${s.id}`} aria-labelledby={`titulo-${s.id}`} className="scroll-mt-24 rounded-xl border bg-card p-5">
                    <h2 id={`titulo-${s.id}`} className="text-base font-semibold">{s.titulo}</h2>
                    {conteudoDa(s.id)}
                  </section>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {pronto && !soDivulgar && (
        <BarraDoCadastro
          editando={!!editandoId}
          salvando={salvando}
          aoCancelar={cancelar}
          aoSalvarRascunho={() => criar(true)}
          aoCriar={() => criar(false)}
          aoSalvar={salvar}
        />
      )}
      {dialogoDeConfirmacao}
    </div>
  );
}
