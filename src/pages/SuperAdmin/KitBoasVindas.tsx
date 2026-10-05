import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ArrowDown, ArrowUp, Film, Gift, ImagePlus, Loader2, RotateCcw, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import BarraSalvar from '@/components/base/BarraSalvar';
import { mesmoConteudo, useAlteracoesNaoSalvas } from '@/hooks/useAlteracoesNaoSalvas';
import { siteBuilderService } from '@/services/siteBuilder/siteBuilderService';
import clientInstancesService, { type CentralInstance } from '@/services/clientInstances/clientInstancesService';
import { welcomeKitService, type KitConfigPayload, type KitToSave } from '@/services/superAdmin/welcomeKitService';
import {
  MAX_IMAGENS, MAX_LEGENDA, moverImagem, motivo, previaDoTexto, problemaNaImagem, problemaNoVideo, tamanhoLegivel,
} from './kitBoasVindasRegras';

/**
 * Área do Admin → Plataforma → Kit de boas-vindas.
 *
 * O kit que a Leal Mídia manda no grupo de um cliente novo: o texto com o
 * endereço do CRM, o vídeo de como instalar o aplicativo e as imagens de como
 * conectar o WhatsApp. Montado UMA vez aqui, vale para todo cliente. O envio é
 * por cliente, em Clientes → Funções (bloco Kit de boas-vindas).
 *
 * O link é o endereço do CRM, nunca o link de acesso (pessoal, uso único, 24h).
 */
export default function KitBoasVindas() {
  const [carregado, setCarregado] = useState<KitToSave | null>(null);
  const [form, setForm] = useState<KitToSave | null>(null);
  const [padrao, setPadrao] = useState('');
  const [configurado, setConfigurado] = useState(true);
  const [vars, setVars] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [subindo, setSubindo] = useState<'video' | 'imagem' | null>(null);
  const [instancias, setInstancias] = useState<CentralInstance[]>([]);
  const videoRef = useRef<HTMLInputElement | null>(null);
  const imagemRef = useRef<HTMLInputElement | null>(null);

  // Texto em branco no servidor = padrão de fábrica: a tela mostra o padrão no campo.
  const aplicar = useCallback((p: KitConfigPayload) => {
    const f: KitToSave = {
      template: p.kit.raw_template.trim() ? p.kit.raw_template : p.default_template,
      instance: p.kit.instance,
      video: p.kit.video,
      images: p.kit.images,
    };
    setPadrao(p.default_template);
    setConfigurado(p.kit.configured);
    setVars(p.vars);
    setCarregado(f);
    setForm(f);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      aplicar(await welcomeKitService.get());
      setErro(null);
    } catch (e) {
      setErro(motivo(e, 'Não consegui carregar o kit agora.'));
    } finally {
      setLoading(false);
    }
  }, [aplicar]);

  useEffect(() => {
    void load();
    // Falha da lista de números não derruba a tela: a lista cai no valor gravado.
    clientInstancesService.centralInstances()
      .then(r => setInstancias(r.data?.data ?? []))
      .catch(() => setInstancias([]));
  }, [load]);

  const temAlteracao = !!form && !!carregado && !mesmoConteudo(form, carregado);
  useAlteracoesNaoSalvas(temAlteracao);

  const set = (patch: Partial<KitToSave>) => setForm(f => (f ? { ...f, ...patch } : f));

  const salvar = async () => {
    if (!form) return;
    setSalvando(true);
    try {
      // Texto igual ao padrão não é gravado: gravar o padrão travaria o texto no
      // dia em que o padrão da casa mudasse.
      const template = form.template.trim() === padrao.trim() ? '' : form.template;
      aplicar(await welcomeKitService.save({ ...form, template }));
      toast.success('Kit salvo. Vale para todos os clientes.');
    } catch (e) {
      toast.error(motivo(e, 'Não consegui salvar o kit.'));
    } finally {
      setSalvando(false);
    }
  };

  const onVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (videoRef.current) videoRef.current.value = '';
    if (!file) return;
    const problema = problemaNoVideo(file);
    if (problema) { toast.error(problema); return; }
    setSubindo('video');
    try {
      const { url } = await siteBuilderService.uploadAsset(file);
      set({ video: { url, name: file.name, size: file.size } });
    } catch (err) {
      toast.error(motivo(err, 'Não consegui enviar o vídeo.'));
    } finally {
      setSubindo(null);
    }
  };

  const onImagem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (imagemRef.current) imagemRef.current.value = '';
    if (!file || !form) return;
    const problema = problemaNaImagem(file);
    if (problema) { toast.error(problema); return; }
    setSubindo('imagem');
    try {
      const { url } = await siteBuilderService.uploadAsset(file);
      setForm(f => (f ? { ...f, images: [...f.images, { url, caption: '' }].slice(0, MAX_IMAGENS) } : f));
    } catch (err) {
      toast.error(motivo(err, 'Não consegui enviar a imagem.'));
    } finally {
      setSubindo(null);
    }
  };

  const legenda = (i: number, caption: string) =>
    setForm(f => (f ? { ...f, images: f.images.map((img, j) => (j === i ? { ...img, caption } : img)) } : f));

  const nomesDasInstancias = instancias.map(i => i.name);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Gift className="h-5 w-5" /> Kit de boas-vindas
        </h2>
        <p className="text-sm text-muted-foreground">
          O que vai no grupo de um cliente novo: o endereço do CRM, o vídeo de como instalar o aplicativo e
          as imagens de como conectar o WhatsApp. Montado aqui, vale para todos. O envio é cliente a cliente,
          em Clientes → Funções.
        </p>
      </header>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      )}

      {erro && !loading && (
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" /> {erro}
          </p>
          <Button type="button" variant="outline" onClick={() => void load()}>Tentar de novo</Button>
        </div>
      )}

      {form && !erro && (
        <>
          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <label htmlFor="kit-mensagem" className="text-sm font-semibold">Mensagem</label>
              <button
                type="button"
                onClick={() => set({ template: padrao })}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Voltar ao padrão
              </button>
            </div>
            <textarea
              id="kit-mensagem"
              value={form.template}
              onChange={e => set({ template: e.target.value })}
              rows={7}
              className="w-full rounded-lg border border-border bg-background p-3 text-sm leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              Trechos preenchidos na hora do envio:{' '}
              {vars.map(v => (
                <code key={v} className="mr-1 rounded bg-muted px-1">{`{${v}}`}</code>
              ))}
              — <code className="rounded bg-muted px-1">{'{link}'}</code> é o endereço do CRM do cliente, nunca o link de acesso.
            </p>

            <div className="pt-2">
              <label htmlFor="kit-numero" className="mb-1 block text-xs font-medium text-muted-foreground">
                Número que envia
              </label>
              <Seletor
                id="kit-numero"
                value={form.instance}
                onChange={e => set({ instance: e.target.value })}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {!nomesDasInstancias.includes(form.instance) && <option value={form.instance}>{form.instance}</option>}
                {instancias.map(i => (
                  <option key={i.name} value={i.name}>{i.name}{i.connected ? '' : ' (desconectado)'}</option>
                ))}
              </Seletor>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Vídeo de como baixar o aplicativo</h3>
            <p className="text-xs text-muted-foreground">Um vídeo só, em MP4, até 16 MB (o limite do WhatsApp).</p>
            <input
              ref={videoRef} type="file" accept="video/mp4" className="hidden"
              data-testid="kit-video-input" onChange={onVideo}
            />
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Film className="h-5 w-5 flex-none text-muted-foreground" />
              <div className="min-w-0 flex-1 text-sm">
                {form.video
                  ? <><div className="truncate font-medium">{form.video.name}</div>
                      <div className="text-xs text-muted-foreground">{tamanhoLegivel(form.video.size)}</div></>
                  : <span className="text-muted-foreground">Nenhum vídeo. O kit sai sem ele.</span>}
              </div>
              <Button
                type="button" variant="outline" size="sm" disabled={subindo !== null}
                onClick={() => videoRef.current?.click()}
              >
                {subindo === 'video'
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                {form.video ? 'Trocar' : 'Enviar vídeo'}
              </Button>
              {form.video && (
                <Button type="button" variant="ghost" size="sm" onClick={() => set({ video: null })}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Tirar
                </Button>
              )}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Imagens de como conectar o WhatsApp</h3>
            <p className="text-xs text-muted-foreground">
              Até {MAX_IMAGENS}, em ordem, JPG ou PNG até 5 MB. A legenda vai junto de cada imagem.
            </p>
            <input
              ref={imagemRef} type="file" accept="image/jpeg,image/png" className="hidden"
              data-testid="kit-imagem-input" onChange={onImagem}
            />
            {form.images.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma imagem. O kit sai sem elas.</p>
            )}
            {form.images.map((img, i) => (
              <div key={`${img.url}-${i}`} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <img src={img.url} alt="" className="h-16 w-16 flex-none rounded object-cover" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Imagem {i + 1}</div>
                  <input
                    value={img.caption}
                    onChange={e => legenda(i, e.target.value.slice(0, MAX_LEGENDA))}
                    aria-label={`Legenda da imagem ${i + 1}`}
                    placeholder="Legenda (opcional)"
                    className="h-8 w-full rounded border border-border bg-background px-2 text-sm"
                  />
                  <div className="text-right text-[11px] text-muted-foreground">{img.caption.length}/{MAX_LEGENDA}</div>
                </div>
                <div className="flex flex-none flex-col gap-1">
                  <Button
                    type="button" variant="ghost" size="sm" disabled={i === 0}
                    aria-label={`Subir a imagem ${i + 1}`} title="Subir"
                    onClick={() => set({ images: moverImagem(form.images, i, -1) })}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button" variant="ghost" size="sm" disabled={i === form.images.length - 1}
                    aria-label={`Descer a imagem ${i + 1}`} title="Descer"
                    onClick={() => set({ images: moverImagem(form.images, i, 1) })}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button" variant="ghost" size="sm"
                    aria-label={`Tirar a imagem ${i + 1}`} title="Tirar"
                    onClick={() => set({ images: form.images.filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {form.images.length < MAX_IMAGENS && (
              <Button
                type="button" variant="outline" size="sm" disabled={subindo !== null}
                onClick={() => imagemRef.current?.click()}
              >
                {subindo === 'imagem'
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <ImagePlus className="mr-1.5 h-3.5 w-3.5" />}
                Adicionar imagem
              </Button>
            )}
          </section>

          <section className="space-y-2 rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Prévia</h3>
            <p className="text-xs text-muted-foreground">Como chega no grupo, nesta ordem, com um cliente de exemplo.</p>
            <div className="space-y-2 rounded-lg bg-muted p-3">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-background px-3 py-2 text-sm shadow-sm">
                {previaDoTexto(form.template)}
              </div>
              {form.video && (
                <div className="flex max-w-[85%] items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm shadow-sm">
                  <Film className="h-4 w-4 text-muted-foreground" /> {form.video.name}
                </div>
              )}
              {form.images.map((img, i) => (
                <div key={`p-${img.url}-${i}`} className="max-w-[60%] rounded-lg bg-background p-1.5 shadow-sm">
                  <img src={img.url} alt="" className="max-h-40 rounded" />
                  {img.caption && <div className="px-1.5 pt-1 text-sm">{img.caption}</div>}
                </div>
              ))}
            </div>
          </section>

          {/* Kit nunca salvo: a barra aparece mesmo sem mexer. Sem isso, quem só quer o
              texto padrão não consegue salvar, e o bloco de Funções segue dizendo
              que o kit não foi montado. */}
          <BarraSalvar
            visivel={temAlteracao || !configurado}
            salvando={salvando}
            aoSalvar={() => void salvar()}
            aoDescartar={() => setForm(carregado)}
          />
        </>
      )}
    </div>
  );
}
