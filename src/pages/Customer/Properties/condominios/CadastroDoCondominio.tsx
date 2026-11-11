// Cadastro do condomínio em página, no molde do cadastro de imóvel (índice que
// acompanha a rolagem, seções em cartões e barra fixa embaixo).
//   /properties/condominios/novo[?voltar=/properties/<id>/editar]   criar
//   /properties/condominios/:id                                      ver e editar
// Ver é properties.read (a rota); criar, salvar, excluir e as fotos pedem
// condominiums.manage. Sem ela, a página abre só para leitura.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Aviso, BaseHeader, BotaoMaisAcoes, EmptyState, Pagina } from '@/components/base';
import { Seletor } from '@/components/base/Seletor';
import { Card, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Label as UILabel } from '@/components/ui/ds';
import NoAccessState from '@/components/permissions/NoAccessState';
import { useNomeDaAba } from '@/components/layout/nomeDaAba';
import { useCan } from '@/hooks/useCan';
import { useAlteracoesNaoSalvas, mesmoConteudo, PEDIDO_SAIR_SEM_SALVAR } from '@/hooks/useAlteracoesNaoSalvas';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { isForbiddenError } from '@/services/core/forbidden';
import { plural } from '@/lib/formato';
import {
  ROTULO_DO_TIPO, condominiumsService, type Condominium, type CondominiumContact, type CondominiumKind,
} from '@/services/condominiums/condominiumsService';
import { CONDO_FEATURES } from '@/features/properties/amenities';
import {
  ABA_CONDOMINIOS, CONDOMINIO_VAZIO, caminhoDeVolta, condominioNaTela, destinoDepoisDeCriar, errosDoCondominio, formularioDoCondominio,
  payloadDoCondominio, pedidoDeExclusao, secaoDoErro, textoDasUnidades, type CondominioNaTela,
} from '@/features/properties/condominios/regrasDoCondominio';
import IndiceDoCadastro from '../cadastro/IndiceDoCadastro';
import BarraDoCadastro from '../cadastro/BarraDoCadastro';
import { useSecaoVisivel } from '../cadastro/useSecaoVisivel';
import { CampoNumero, CampoTexto } from '../cadastro/secoes/campos';
import SecaoLocalizacao from '../cadastro/secoes/SecaoLocalizacao';
import SecaoContatos from './SecaoContatos';
import SecaoUnidades from './SecaoUnidades';
import SecaoFotosDasAreasComuns from './SecaoFotosDasAreasComuns';

type SecaoId = 'basico' | 'localizacao' | 'comodidades' | 'fotos' | 'contatos' | 'unidades';
type Mudanca = Partial<CondominioNaTela> | ((prev: CondominioNaTela) => Partial<CondominioNaTela>);

const SECOES: { id: SecaoId; titulo: string }[] = [
  { id: 'basico', titulo: 'Básico' },
  { id: 'localizacao', titulo: 'Localização' },
  { id: 'comodidades', titulo: 'Comodidades do condomínio' },
  { id: 'fotos', titulo: 'Fotos das áreas comuns' },
  { id: 'contatos', titulo: 'Contatos' },
  { id: 'unidades', titulo: 'Unidades plugadas' },
];

const TIPOS = Object.entries(ROTULO_DO_TIPO) as [CondominiumKind, string][];
const ABA_DA_LISTA = `/properties?aba=${ABA_CONDOMINIOS}`;
// Mesma espera do cadastro do imóvel: o índice fica na seção do erro enquanto a rolagem anda.
const ESPERA_DA_ROLAGEM_MS = 800;

const rolarAte = (secao: SecaoId) =>
  document.getElementById(`secao-${secao}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

// A mensagem real do servidor (envelope { error: { code, message } }), não um genérico.
function mensagemDoErro(e: unknown, reserva: string): string {
  const err = e as { response?: { data?: { error?: { message?: string }; message?: string } } };
  return err?.response?.data?.error?.message || err?.response?.data?.message || reserva;
}

export default function CadastroDoCondominio() {
  const { id } = useParams();
  // Outro condomínio na mesma rota recomeça a página do zero.
  return <Cadastro key={id ?? 'novo'} />;
}

function Cadastro() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const podeMudar = useCan()('condominiums', 'manage');
  const somenteLeitura = !podeMudar;
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const editandoId = id ?? null;
  const [condominio, setCondominio] = useState<Condominium | null>(null);
  useNomeDaAba(condominio?.name ?? null);
  const [erroDeCarga, setErroDeCarga] = useState(false);
  const [recusado, setRecusado] = useState(false);
  // 404: o condomínio não existe (excluído ou endereço errado). Não é recusa por cargo.
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [form, setForm] = useState<CondominioNaTela>(() => condominioNaTela(CONDOMINIO_VAZIO));
  const [inicial, setInicial] = useState(form);
  const setF = (patch: Mudanca) => setForm(prev => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));

  // Fotos escolhidas na criação: sobem logo depois de criar o condomínio.
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);

  const pronto = !editandoId || !!condominio;
  const secoes = editandoId ? SECOES : SECOES.filter(s => s.id !== 'unidades');
  const [secaoComErro, setSecaoComErro] = useState<SecaoId | null>(null);
  const visivel = useSecaoVisivel(pronto ? secoes.map(s => s.id) : []);
  const ativa = secaoComErro ?? visivel;
  const erroMarcadoEm = useRef(0);
  useEffect(() => {
    if (Date.now() - erroMarcadoEm.current > ESPERA_DA_ROLAGEM_MS) setSecaoComErro(null);
  }, [visivel]);

  const temAlteracao = pronto && podeMudar && (!mesmoConteudo(form, inicial) || arquivos.length > 0);
  useAlteracoesNaoSalvas(temAlteracao);

  const carregar = useCallback(() => {
    if (!editandoId) return;
    setErroDeCarga(false);
    setNaoEncontrado(false);
    condominiumsService.get(editandoId)
      .then(c => { setCondominio(c); const f = condominioNaTela(formularioDoCondominio(c)); setForm(f); setInicial(f); })
      .catch(e => {
        const status = (e as { response?: { status?: number } } | null)?.response?.status;
        if (isForbiddenError(e)) setRecusado(true);
        else if (status === 404) setNaoEncontrado(true);
        else setErroDeCarga(true);
      });
  }, [editandoId]);
  useEffect(() => { carregar(); }, [carregar]);

  // Sair da página (lista, unidade, fotos): com alteração não salva, pergunta antes.
  const sairPara = async (caminho: string) => {
    if (temAlteracao && !(await confirmar({ ...PEDIDO_SAIR_SEM_SALVAR, rotuloDaAcao: 'Sair' }))) return;
    navigate(caminho);
  };

  const irParaErro = (mensagem: string) => {
    const secao = secaoDoErro(mensagem);
    toast.error(mensagem);
    setSecaoComErro(secao);
    erroMarcadoEm.current = Date.now();
    rolarAte(secao);
  };

  const criar = async () => {
    const payload = payloadDoCondominio(form);
    const erros = errosDoCondominio(payload);
    if (erros.length) { irParaErro(erros[0]); return; }
    setSalvando(true);
    try {
      const criado = await condominiumsService.create(payload);
      if (arquivos.length) {
        try {
          await condominiumsService.fotos.upload(criado.id, arquivos);
          toast.success(`Condomínio cadastrado com ${plural(arquivos.length, 'foto', 'fotos')}`);
        } catch {
          toast.warning('Condomínio cadastrado, mas algumas fotos falharam. Reenvie em Gerenciar fotos.');
        }
      } else {
        toast.success('Condomínio cadastrado');
      }
      // A página nova não pode perguntar "sair sem salvar?" do que acabou de ser salvo.
      setInicial(form);
      setArquivos([]);
      navigate(destinoDepoisDeCriar(sp.get('voltar'), criado.id));
    } catch (e) {
      toast.error(mensagemDoErro(e, 'Erro ao salvar o condomínio'));
    } finally {
      setSalvando(false);
    }
  };

  const salvar = async () => {
    if (!condominio) return;
    const payload = payloadDoCondominio(form);
    const erros = errosDoCondominio(payload);
    if (erros.length) { irParaErro(erros[0]); return; }
    setSalvando(true);
    try {
      await condominiumsService.update(condominio.id, payload);
      toast.success('Condomínio atualizado');
      setInicial(form);
      // Aberto de "Editar no condomínio" (?voltar=): volta pra unidade, como o Cancelar.
      navigate(caminhoDeVolta(sp.get('voltar')) ?? ABA_DA_LISTA);
    } catch (e) {
      toast.error(mensagemDoErro(e, 'Erro ao salvar o condomínio'));
    } finally {
      setSalvando(false);
    }
  };

  const unidades = condominio ? (condominio.units_count ?? condominio.units?.length ?? 0) : 0;

  const excluir = async () => {
    if (!condominio) return;
    if (!(await confirmar({ ...pedidoDeExclusao(condominio.name, unidades), rotuloDaAcao: 'Excluir', destrutivo: true }))) return;
    try {
      await condominiumsService.remove(condominio.id);
      toast.success('Condomínio excluído');
      setInicial(form);
      navigate(ABA_DA_LISTA);
    } catch (e) {
      toast.error(mensagemDoErro(e, 'Não deu pra excluir o condomínio'));
    }
  };

  if (recusado || (!editandoId && !podeMudar)) return <NoAccessState />;

  const alternarComodidade = (slug: string) =>
    setF(prev => {
      const atual = prev.condo_features ?? [];
      return { condo_features: atual.includes(slug) ? atual.filter(s => s !== slug) : [...atual, slug] };
    });

  const conteudoDa = (secao: SecaoId): ReactNode => {
    switch (secao) {
      case 'basico':
        return (
          <fieldset disabled={somenteLeitura} className="m-0 mt-4 grid min-w-0 grid-cols-1 gap-4 border-0 p-0 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <CampoTexto rotulo="Nome do condomínio" valor={form.name} aoMudar={v => setF({ name: v })} />
            </div>
            <div>
              <UILabel htmlFor="campo-tipo-do-condominio">Tipo</UILabel>
              <Seletor id="campo-tipo-do-condominio" value={form.kind} onChange={e => setF({ kind: e.target.value as CondominiumKind })} className="mt-1 w-full">
                {TIPOS.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
              </Seletor>
            </div>
            <CampoNumero rotulo="Ano de construção" valor={form.year_built} placeholder="2015" aoMudar={v => setF({ year_built: v })} />
            <CampoTexto rotulo="Construtora" valor={form.builder_name} aoMudar={v => setF({ builder_name: v })} />
            <CampoTexto rotulo="Incorporadora" valor={form.developer_name} aoMudar={v => setF({ developer_name: v })} />
            <CampoTexto rotulo="Administradora" valor={form.administrator_name} aoMudar={v => setF({ administrator_name: v })} />
            <div className="sm:col-span-2">
              <CampoTexto rotulo="Observação interna" multilinha valor={form.internal_note} ajuda="Só a imobiliária vê."
                aoMudar={v => setF({ internal_note: v })} />
            </div>
          </fieldset>
        );
      case 'localizacao':
        return <SecaoLocalizacao form={form} setF={setF} somenteLeitura={somenteLeitura} />;
      case 'comodidades':
        return (
          <fieldset disabled={somenteLeitura} className="m-0 mt-4 flex min-w-0 flex-wrap gap-2 border-0 p-0">
            <legend className="sr-only">Comodidades do condomínio</legend>
            {CONDO_FEATURES.map(a => {
              const on = (form.condo_features ?? []).includes(a.slug);
              return (
                <button
                  key={a.slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => alternarComodidade(a.slug)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:bg-muted'}`}
                >
                  {a.label}
                </button>
              );
            })}
          </fieldset>
        );
      case 'fotos':
        return (
          <SecaoFotosDasAreasComuns
            condominioId={condominio?.id ?? null}
            total={condominio?.photos_count ?? 0}
            arquivos={arquivos}
            aoMudarArquivos={setArquivos}
            enviando={salvando}
            aoGerenciar={podeMudar && condominio ? () => void sairPara(`/properties/condominios/${condominio.id}/fotos`) : undefined}
          />
        );
      case 'contatos':
        return (
          <SecaoContatos
            contatos={form.contacts ?? []}
            aoMudar={(contatos: CondominiumContact[]) => setF({ contacts: contatos })}
            somenteLeitura={somenteLeitura}
          />
        );
      case 'unidades':
        return <SecaoUnidades unidades={condominio?.units ?? []} aoAbrir={caminho => void sairPara(caminho)} />;
    }
  };

  const voltar = (
    <Link
      to={ABA_DA_LISTA}
      onClick={e => { if (temAlteracao) { e.preventDefault(); void sairPara(ABA_DA_LISTA); } }}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />Condomínios
    </Link>
  );

  const titulo = !editandoId ? 'Novo condomínio' : podeMudar ? 'Editar condomínio' : 'Condomínio';
  const avisoDasUnidades = textoDasUnidades(unidades);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <Pagina
          acima={voltar}
          cabecalho={
            <BaseHeader
              title={titulo}
              subtitle={condominio?.name}
              aDireita={podeMudar && condominio ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <BotaoMaisAcoes />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem variant="destructive" onClick={() => void excluir()}><Trash2 className="h-4 w-4" />Excluir condomínio</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : undefined}
            />
          }
        >
          {!pronto ? (
            naoEncontrado ? (
              <EmptyState
                title="Condomínio não encontrado"
                description="Ele pode ter sido excluído."
                action={{ label: 'Voltar para Condomínios', onClick: () => navigate(ABA_DA_LISTA) }}
              />
            ) : erroDeCarga ? <EmptyState tipo="erro" aoTentarDeNovo={carregar} /> : (
              <div role="status" className="flex flex-col gap-3">
                <span className="sr-only">Carregando o condomínio</span>
                {[0, 1, 2].map(i => <div key={i} className="h-32 animate-pulse rounded-xl border bg-muted/40" />)}
              </div>
            )
          ) : (
            <div className="max-w-6xl">
              <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
                <IndiceDoCadastro
                  secoes={secoes}
                  ativa={ativa}
                  aoEscolher={secao => { setSecaoComErro(null); rolarAte(secao); }}
                />
                <div className="mt-4 space-y-4 lg:mt-0">
                  {avisoDasUnidades && <Aviso tom="info">{avisoDasUnidades}</Aviso>}
                  {secoes.map(s => (
                    <Card role="region" key={s.id} id={`secao-${s.id}`} aria-labelledby={`titulo-${s.id}`} className="scroll-mt-24 gap-0 p-5">
                      <h2 id={`titulo-${s.id}`} className="text-base font-semibold">{s.titulo}</h2>
                      {conteudoDa(s.id)}
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Pagina>
      </div>

      {pronto && podeMudar && (
        <BarraDoCadastro
          editando={!!editandoId}
          salvando={salvando}
          aoCancelar={() => void sairPara(caminhoDeVolta(sp.get('voltar')) ?? ABA_DA_LISTA)}
          aoCriar={() => void criar()}
          aoSalvar={() => void salvar()}
          rotuloDoCriar="Criar condomínio"
        />
      )}
      {dialogoDeConfirmacao}
    </div>
  );
}
