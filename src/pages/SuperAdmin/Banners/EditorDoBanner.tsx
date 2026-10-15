// Editor do banner (janela larga: formulário à esquerda, prévia à direita).
//
// O banner novo só nasce no servidor no primeiro Salvar ou no primeiro envio de
// arte: abrir e cancelar não deixa rascunho sobrando. Publicar salva, conta o
// público no servidor e confirma com o número ("Mostrar para 340 pessoas de 31
// imobiliárias?"); se a conta mudar entre a pergunta e o clique, o servidor
// recusa e a pergunta volta com o número novo.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import { CampoDaJanela, CaixaDaJanela, GradeDaJanela, GrupoDaJanela } from '@/components/base/janela';
import {
  Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Textarea,
} from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { dashboardBannersService as svc } from '@/services/superAdmin/dashboardBannersService';
import type {
  AcaoDoBanner, ArteDoBanner, BannerAdmin, CamposDoBanner, CargoDoBanner, ImobiliariaDoBanner,
} from '@/types/admin/dashboardBanners';
import { Seletor } from '@/components/base/Seletor';
import { getCustomerMenuSections, getFooterMenuItems } from '@/components/layout/config/menuItems';
import { CARGOS, MEDIDA_DA_ARTE, doCampo, nomeDaTela, paraOCampo, perguntaDoPublico, telasDoMenu } from './regras';

// Lidas uma vez: o menu do cliente é fixo no código.
const TELAS = telasDoMenu(getCustomerMenuSections(), getFooterMenuItems());
const OUTRO = '__outro';

interface Props {
  aberto: boolean;
  banner: BannerAdmin | null;
  imobiliarias: ImobiliariaDoBanner[];
  aoMudar: (banner: BannerAdmin) => void;
  aoFechar: () => void;
}

interface Formulario {
  name: string;
  click_action: AcaoDoBanner;
  details_title: string;
  details_body: string;
  details_button_path: string;
  link_url: string;
  roles: CargoDoBanner[];
  todas: boolean;
  tenant_slugs: string[];
  starts_at: string;
  ends_at: string;
}

function formularioDe(b: BannerAdmin | null): Formulario {
  return {
    name: b?.name ?? '',
    click_action: b?.click_action ?? 'details',
    details_title: b?.details_title ?? '',
    details_body: b?.details_body ?? '',
    details_button_path: b?.details_button_path ?? '',
    link_url: b?.link_url ?? '',
    roles: b?.roles ?? ['admin', 'manager', 'agent'],
    todas: (b?.tenant_slugs ?? []).length === 0,
    tenant_slugs: b?.tenant_slugs ?? [],
    starts_at: paraOCampo(b?.starts_at),
    ends_at: paraOCampo(b?.ends_at),
  };
}

function camposDe(f: Formulario): CamposDoBanner {
  return {
    name: f.name.trim(),
    click_action: f.click_action,
    details_title: f.details_title,
    details_body: f.details_body,
    details_button_path: f.details_button_path,
    link_url: f.link_url,
    roles: f.roles,
    tenant_slugs: f.todas ? [] : f.tenant_slugs,
    starts_at: doCampo(f.starts_at),
    // Banner novo sem fim escolhido: o servidor põe 14 dias.
    ...(f.ends_at ? { ends_at: doCampo(f.ends_at) } : {}),
  };
}

const motivo = (e: unknown, padrao: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error || padrao;

export default function EditorDoBanner({ aberto, banner, imobiliarias, aoMudar, aoFechar }: Props) {
  const [atual, setAtual] = useState<BannerAdmin | null>(banner);
  const [form, setForm] = useState<Formulario>(() => formularioDe(banner));
  const [inicial, setInicial] = useState<Formulario>(() => formularioDe(banner));
  const [ocupado, setOcupado] = useState<null | 'salvar' | 'publicar' | ArteDoBanner>(null);
  const [busca, setBusca] = useState('');
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  useEffect(() => {
    if (!aberto) return;
    setAtual(banner);
    setForm(formularioDe(banner));
    setInicial(formularioDe(banner));
    setBusca('');
  }, [aberto, banner]);

  const mudou = JSON.stringify(form) !== JSON.stringify(inicial);
  const publicado = atual?.status === 'published';
  const muda = <K extends keyof Formulario>(chave: K, valor: Formulario[K]) => setForm((f) => ({ ...f, [chave]: valor }));

  const guardar = (b: BannerAdmin) => {
    setAtual(b);
    aoMudar(b);
    const novo = formularioDe(b);
    setForm(novo);
    setInicial(novo);
    return b;
  };

  // Cria (se ainda não existe) ou salva o que está no formulário.
  const salvarNoServidor = async (): Promise<BannerAdmin> => {
    const campos = camposDe(form);
    return guardar(atual ? await svc.salvar(atual.id, campos) : await svc.criar(campos));
  };

  const salvar = async () => {
    setOcupado('salvar');
    try { await salvarNoServidor(); toast.success('Banner salvo.'); }
    catch (e) { toast.error(motivo(e, 'Não deu pra salvar o banner.')); }
    finally { setOcupado(null); }
  };

  const publicar = async () => {
    setOcupado('publicar');
    try {
      const salvo = await salvarNoServidor();
      let publico = await svc.contarPublico(salvo.roles, salvo.tenant_slugs);
      for (let tentativa = 0; tentativa < 2; tentativa += 1) {
        const sim = await confirmar({
          titulo: perguntaDoPublico(publico),
          descricao: publico.unreadable.length
            ? `Não consegui contar: ${publico.unreadable.join(', ')}. Eles recebem mesmo assim.`
            : 'O banner aparece na Dashboard de cada pessoa a partir do início escolhido.',
          rotuloDaAcao: 'Publicar',
        });
        if (!sim) return;
        try {
          guardar(await svc.publicar(salvo.id, publico.people));
          toast.success('Banner publicado.');
          aoFechar();
          return;
        } catch (e) {
          const novo = (e as { response?: { status?: number; data?: { audience?: typeof publico } } })?.response;
          if (novo?.status !== 409 || !novo.data?.audience) throw e;
          publico = novo.data.audience;
        }
      }
    } catch (e) {
      toast.error(motivo(e, 'Não deu pra publicar o banner.'));
    } finally {
      setOcupado(null);
    }
  };

  const enviarArte = async (arte: ArteDoBanner, arquivo: File | undefined) => {
    if (!arquivo) return;
    setOcupado(arte);
    try {
      const salvo = atual ?? (await salvarNoServidor());
      guardar(await svc.enviarArte(salvo.id, arte, arquivo));
    } catch (e) {
      toast.error(motivo(e, 'Não deu pra enviar a arte.'));
    } finally {
      setOcupado(null);
    }
  };

  const tirarArte = async (arte: ArteDoBanner) => {
    if (!atual) return;
    setOcupado(arte);
    try { guardar(await svc.tirarArte(atual.id, arte)); }
    catch (e) { toast.error(motivo(e, 'Não deu pra tirar a imagem.')); }
    finally { setOcupado(null); }
  };

  const fechar = async () => {
    if (ocupado) return;
    if (mudou && !(await confirmar({ titulo: 'Sair sem salvar?', descricao: 'As alterações deste banner se perdem.', rotuloDaAcao: 'Sair sem salvar', destrutivo: true }))) return;
    aoFechar();
  };

  const imobiliariasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo ? imobiliarias.filter((i) => i.name.toLowerCase().includes(termo)) : imobiliarias;
  }, [busca, imobiliarias]);

  const alternarCargo = (cargo: CargoDoBanner, sim: boolean) =>
    muda('roles', sim ? [...form.roles, cargo] : form.roles.filter((c) => c !== cargo));
  const alternarImobiliaria = (slug: string, sim: boolean) =>
    muda('tenant_slugs', sim ? [...form.tenant_slugs, slug] : form.tenant_slugs.filter((s) => s !== slug));

  return (
    <>
      <Dialog open={aberto} onOpenChange={(sim) => { if (!sim) void fechar(); }}>
        <DialogContent size="wide">
          <DialogHeader><DialogTitle>{atual ? atual.name : 'Novo banner'}</DialogTitle></DialogHeader>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-6">
              <GrupoDaJanela titulo="Identificação">
                <CampoDaJanela rotulo="Nome interno" htmlFor="banner-nome" ajuda="Só a Leal Mídia vê.">
                  <Input id="banner-nome" placeholder="Ex.: Atualização de mensagens prontas" value={form.name}
                    onChange={(e) => muda('name', e.target.value)} />
                </CampoDaJanela>
              </GrupoDaJanela>

              <GrupoDaJanela titulo="Arte">
                <GradeDaJanela>
                  <CampoDeArte arte="desktop" titulo="Arte do computador" medida={MEDIDA_DA_ARTE.desktop}
                    url={atual?.desktop_url ?? null} ocupado={ocupado === 'desktop'} aoEscolher={enviarArte} className="sm:col-span-2" />
                  <CampoDeArte arte="mobile" titulo="Arte do celular" medida={MEDIDA_DA_ARTE.mobile}
                    url={atual?.mobile_url ?? null} ocupado={ocupado === 'mobile'} aoEscolher={enviarArte} className="sm:col-span-2" />
                </GradeDaJanela>
              </GrupoDaJanela>

              <GrupoDaJanela titulo="Ao clicar">
                <BotoesDeEscolha<AcaoDoBanner>
                  rotulo="Ao clicar"
                  valor={form.click_action}
                  aoEscolher={(v) => muda('click_action', v)}
                  opcoes={[
                    { valor: 'details', rotulo: 'Abrir detalhes' },
                    { valor: 'link', rotulo: 'Ir pra uma tela' },
                    { valor: 'none', rotulo: 'Nada' },
                  ]}
                />
                {form.click_action === 'details' && (
                  <GrupoDaJanela titulo="Janela de detalhes">
                    <CampoDaJanela rotulo="Título" htmlFor="banner-titulo">
                      <Input id="banner-titulo" placeholder="Mensagens prontas agora ficam do lado da conversa"
                        value={form.details_title} onChange={(e) => muda('details_title', e.target.value)} />
                    </CampoDaJanela>
                    <CampoDaJanela rotulo="Texto" htmlFor="banner-texto">
                      <Textarea id="banner-texto" rows={6} value={form.details_body}
                        onChange={(e) => muda('details_body', e.target.value)} />
                    </CampoDaJanela>
                    <CampoDeArte arte="details" titulo="Imagem (opcional)" medida="Qualquer medida, até 5 MB"
                      url={atual?.details_image_url ?? null} ocupado={ocupado === 'details'} aoEscolher={enviarArte}
                      aoTirar={atual?.details_image_url ? () => void tirarArte('details') : undefined} />
                    <DestinoDoClique
                      id="banner-ver-agora"
                      rotulo="Botão Ver agora leva pra"
                      vazio="Sem botão"
                      ajuda="Sem botão, a janela só tem o Fechar."
                      valor={form.details_button_path}
                      aoMudar={(v) => muda('details_button_path', v)}
                    />
                  </GrupoDaJanela>
                )}
                {form.click_action === 'link' && (
                  <DestinoDoClique
                    id="banner-link"
                    rotulo="Leva pra"
                    vazio="Escolha uma tela"
                    ajuda="Tela do sistema abre na mesma aba; site de fora, em aba nova."
                    valor={form.link_url}
                    aoMudar={(v) => muda('link_url', v)}
                  />
                )}
              </GrupoDaJanela>

              <GrupoDaJanela titulo="Para quem">
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {CARGOS.map((c) => (
                    <label key={c.valor} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={form.roles.includes(c.valor)} onCheckedChange={(v) => alternarCargo(c.valor, v === true)} />
                      {c.rotulo}
                    </label>
                  ))}
                </div>
                <BotoesDeEscolha<'todas' | 'escolher'>
                  rotulo="Imobiliárias"
                  valor={form.todas ? 'todas' : 'escolher'}
                  aoEscolher={(v) => muda('todas', v === 'todas')}
                  opcoes={[{ valor: 'todas', rotulo: 'Todas as imobiliárias' }, { valor: 'escolher', rotulo: 'Escolher' }]}
                />
                {!form.todas && (
                  <CaixaDaJanela
                    titulo="Imobiliárias"
                    contagem={form.tenant_slugs.length}
                    fixo={<Input aria-label="Buscar imobiliária" placeholder="Buscar imobiliária" value={busca}
                      onChange={(e) => setBusca(e.target.value)} />}
                    corpoClassName="max-h-56"
                  >
                    {imobiliariasFiltradas.map((i) => (
                      <label key={i.slug} className="flex items-center gap-2 py-1.5 text-sm">
                        <Checkbox checked={form.tenant_slugs.includes(i.slug)}
                          onCheckedChange={(v) => alternarImobiliaria(i.slug, v === true)} />
                        {i.name}
                      </label>
                    ))}
                  </CaixaDaJanela>
                )}
              </GrupoDaJanela>

              <GrupoDaJanela titulo="Quando">
                <GradeDaJanela>
                  <CampoDaJanela rotulo="Início" htmlFor="banner-inicio" ajuda="Vazio: assim que publicar." colunas={2}>
                    <Input id="banner-inicio" type="datetime-local" value={form.starts_at}
                      onChange={(e) => muda('starts_at', e.target.value)} />
                  </CampoDaJanela>
                  <CampoDaJanela rotulo="Fim" htmlFor="banner-fim" ajuda="Banner novo nasce com 14 dias." colunas={2}>
                    <Input id="banner-fim" type="datetime-local" value={form.ends_at}
                      onChange={(e) => muda('ends_at', e.target.value)} />
                  </CampoDaJanela>
                </GradeDaJanela>
              </GrupoDaJanela>
            </div>

            <Previa banner={atual} form={form} />
          </div>

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => void fechar()} disabled={!!ocupado}>Cancelar</Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {!publicado && (
                <Button variant="outline" onClick={() => void salvar()} disabled={!!ocupado}>
                  {ocupado === 'salvar' && <Loader2 className="h-4 w-4 animate-spin" />}Salvar rascunho
                </Button>
              )}
              {publicado ? (
                <Button onClick={() => void salvar()} disabled={!!ocupado || !mudou}>
                  {ocupado === 'salvar' && <Loader2 className="h-4 w-4 animate-spin" />}Salvar
                </Button>
              ) : (
                <Button onClick={() => void publicar()} disabled={!!ocupado}>
                  {ocupado === 'publicar' && <Loader2 className="h-4 w-4 animate-spin" />}Publicar
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialogoDeConfirmacao}
    </>
  );
}

interface CampoDeArteProps {
  arte: ArteDoBanner;
  titulo: string;
  medida: string;
  url: string | null;
  ocupado: boolean;
  aoEscolher: (arte: ArteDoBanner, arquivo: File | undefined) => void;
  aoTirar?: () => void;
  className?: string;
}

function CampoDeArte({ arte, titulo, medida, url, ocupado, aoEscolher, aoTirar, className }: CampoDeArteProps) {
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <p className="text-[13px] font-medium text-foreground/80">{titulo}</p>
      <p className="text-xs text-muted-foreground">{medida}</p>
      {url && <img src={url} alt={titulo} className="w-full rounded-md border" />}
      <input
        ref={entrada}
        type="file"
        accept={arte === 'details' ? 'image/png,image/jpeg,image/webp,image/gif' : 'image/png,image/jpeg,image/webp'}
        className="sr-only"
        aria-label={`Escolher arquivo: ${titulo}`}
        onChange={(e) => { aoEscolher(arte, e.target.files?.[0]); e.target.value = ''; }}
      />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={ocupado} onClick={() => entrada.current?.click()}>
          {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}{url ? 'Trocar' : 'Enviar'}
        </Button>
        {aoTirar && <Button variant="ghost" size="sm" disabled={ocupado} onClick={aoTirar}>Tirar</Button>}
      </div>
    </div>
  );
}

function Previa({ banner, form }: { banner: BannerAdmin | null; form: Formulario }) {
  return (
    <div className="flex flex-col gap-6 lg:sticky lg:top-0 lg:self-start">
      <div>
        <p className="mb-2 text-sm font-medium">Prévia no computador</p>
        {banner?.desktop_url
          ? <img src={banner.desktop_url} alt="Prévia no computador" className="aspect-[5/1] w-full rounded-xl object-cover" />
          : <div className="grid aspect-[5/1] w-full place-items-center rounded-xl border border-dashed text-xs text-muted-foreground">Envie a arte do computador</div>}
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Prévia no celular</p>
        <div className="w-[360px] max-w-full">
          {banner?.mobile_url
            ? <img src={banner.mobile_url} alt="Prévia no celular" className="aspect-[2/1] w-full rounded-xl object-cover" />
            : <div className="grid aspect-[2/1] w-full place-items-center rounded-xl border border-dashed text-xs text-muted-foreground">Envie a arte do celular</div>}
        </div>
      </div>
      {form.click_action === 'details' && (
        <div>
          <p className="mb-2 text-sm font-medium">Janela ao clicar</p>
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-base font-semibold">{form.details_title || 'Título'}</p>
            {banner?.details_image_url && <img src={banner.details_image_url} alt="" className="w-full rounded-lg" />}
            <p className="whitespace-pre-line text-sm leading-relaxed">{form.details_body || 'Texto dos detalhes.'}</p>
            {form.details_button_path && <p className="self-end text-sm font-medium text-primary">Ver agora →</p>}
          </div>
        </div>
      )}
    </div>
  );
}

interface DestinoDoCliqueProps {
  id: string;
  rotulo: string;
  /** Rótulo da opção vazia ("Sem botão", "Escolha uma tela"). */
  vazio: string;
  ajuda: string;
  valor: string;
  aoMudar: (valor: string) => void;
}

// Pra onde o clique leva: uma tela do menu do cliente, escolhida pelo nome que
// aparece no menu, ou um endereço digitado (site de fora, tela que não está no
// menu). Quem salva é o servidor, que só aceita "/…" ou "https://…".
function DestinoDoClique({ id, rotulo, vazio, ajuda, valor, aoMudar }: DestinoDoCliqueProps) {
  const ehTela = nomeDaTela(TELAS, valor) !== null;
  const [digitando, setDigitando] = useState(!!valor && !ehTela);
  // O valor muda por fora (outro banner aberto, resposta do servidor): a caixa acompanha.
  useEffect(() => {
    if (ehTela) setDigitando(false);
    else if (valor) setDigitando(true);
  }, [valor, ehTela]);
  const escolha = digitando ? OUTRO : ehTela ? valor : '';
  return (
    <CampoDaJanela rotulo={rotulo} htmlFor={id} ajuda={ajuda}>
      <Seletor
        id={id}
        value={escolha}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OUTRO) { setDigitando(true); if (ehTela) aoMudar(''); return; }
          setDigitando(false);
          aoMudar(v);
        }}
        className="w-full"
      >
        <option value="">{vazio}</option>
        {TELAS.map((g) => (
          <optgroup key={g.secao} label={g.secao}>
            {g.telas.map((t) => <option key={t.endereco} value={t.endereco}>{t.rotulo}</option>)}
          </optgroup>
        ))}
        <option value={OUTRO}>Outro endereço ou site</option>
      </Seletor>
      {digitando && (
        <Input aria-label={`${rotulo}: endereço`} placeholder="https://… ou /…" value={valor}
          onChange={(e) => aoMudar(e.target.value)} />
      )}
    </CampoDaJanela>
  );
}
