import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button, Checkbox, Input } from '@/components/ui/ds';
import { Globe, Image as ImageIcon, Loader2, Trash2, Upload, X } from 'lucide-react';
import { extractLogoColors } from '@/utils/logoColors';
import { siteBuilderService } from '@/services/siteBuilder/siteBuilderService';
import HeroImagePicker, { type HeroImagePick } from '@/features/siteBuilder/HeroImagePicker';
import { EMPTY_HERO_IMAGE, HERO_IMAGE_MODE_LABELS, heroImageChoiceFrom, heroImageWarning } from '@/features/siteBuilder/heroImage';
import { Seletor } from '@/components/base/Seletor';
import { Secao, Secoes } from '../ui/Secao';
import { CLASSE_DO_CAMPO, Campo } from '../ui/Campo';
import EnvioDeImagem from '../ui/EnvioDeImagem';
import type { FormProps } from './tipos';

const SITE_FONTS = ['Inter', 'Space Grotesk', 'Lato', 'Poppins', 'Montserrat', 'Roboto'];

interface Props extends FormProps {
  // A prévia da foto de imóvel recém-escolhida mora no pai: o Salvar a limpa.
  heroPickPreview: HeroImagePick | null;
  setHeroPickPreview: (pick: HeroImagePick | null) => void;
}

export default function TelaAparencia({ site, siteForm, setF, heroPickPreview, setHeroPickPreview }: Props) {
  // Vídeo do banner da home (upload → URL pública)
  const bannerVideoInputRef = useRef<HTMLInputElement | null>(null);
  const [bannerVideoUploading, setBannerVideoUploading] = useState(false);

  // Foto do banner da home: escolhida de um imóvel (janela própria) ou enviada.
  // A prévia da foto de imóvel recém-escolhida fica aqui até salvar; depois de
  // salvo, quem diz qual imagem o site serve é o servidor (site.hero_image.url).
  const heroImageInputRef = useRef<HTMLInputElement | null>(null);
  const [heroImageUploading, setHeroImageUploading] = useState(false);
  const [heroPickerOpen, setHeroPickerOpen] = useState(false);

  // Sobe a logo E extrai as cores dela (canvas local, sem IA): preenche
  // logo_url + cor primária/destaque de uma vez. Usuário revisa e salva.
  // Falha no envio sobe pra caixa da imagem, que mostra o aviso.
  const enviarLogo = async (file: File) => {
    // Cores primeiro (arquivo local — funciona mesmo se o upload falhar).
    const colors = await extractLogoColors(file).catch(() => null);
    const { url } = await siteBuilderService.uploadAsset(file);
    setF({
      logo_url: url,
      ...(colors ? { primary_color: colors.primary, accent_color: colors.accent } : {}),
    });
    toast.success(colors
      ? `Logo no ar. Cores extraídas: ${colors.primary} / ${colors.accent} — revise e salve.`
      : 'Logo no ar. Não achei cor de marca na imagem (P&B?) — cores mantidas.');
  };

  // Ícone da aba: mesmo envio do logo, sem mexer nas cores.
  const enviarIcone = async (file: File) => {
    const { url } = await siteBuilderService.uploadAsset(file);
    setF({ favicon_url: url });
  };

  // Sobe o vídeo do banner da home. Fica no form (hero_video_url) até o usuário salvar.
  const handleBannerVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (bannerVideoInputRef.current) bannerVideoInputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) { toast.error('Envie um arquivo de vídeo (MP4/WebM).'); return; }
    if (file.size > 60 * 1024 * 1024) { toast.error('Vídeo muito grande (máx 60MB). Comprima antes de enviar.'); return; }

    setBannerVideoUploading(true);
    try {
      const { url } = await siteBuilderService.uploadAsset(file);
      setF({ hero_video_url: url });
      toast.success('Vídeo no ar. Revise o preview e clique em Salvar.');
    } catch {
      toast.error('Falha no upload do vídeo.');
    } finally {
      setBannerVideoUploading(false);
    }
  };

  // Sobe a foto do banner da home (modo "Enviar uma foto"). Fica no form até salvar.
  const handleHeroImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (heroImageInputRef.current) heroImageInputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Envie um arquivo de imagem (JPG, PNG ou WebP).'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('Imagem muito grande (máx 8MB). Comprima antes de enviar.'); return; }

    setHeroImageUploading(true);
    try {
      const { url } = await siteBuilderService.uploadAsset(file);
      setF({ hero_image: { mode: 'upload', url } });
      toast.success('Foto enviada. Revise a prévia e clique em Salvar.');
    } catch {
      toast.error('Falha no upload da foto.');
    } finally {
      setHeroImageUploading(false);
    }
  };

  const handleHeroPick = (pick: HeroImagePick) => {
    setHeroPickPreview(pick);
    setF({ hero_image: { mode: 'property', property_id: pick.property_id, photo_id: pick.photo_id } });
    setHeroPickerOpen(false);
  };

  return (
    <Secoes>
      <Secao
        titulo="Logotipos"
        descricao="O logo e o ícone que identificam a sua imobiliária no site. Envie o arquivo e clique em Salvar."
      >
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,auto)]">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Logo do site</h3>
              <p className="text-sm text-muted-foreground">Aparece no topo e no rodapé do site.</p>
            </div>
            <EnvioDeImagem
              rotulo="Logo do site"
              url={siteForm.logo_url}
              enviar={enviarLogo}
              aoRemover={() => setF({ logo_url: null })}
              confirmacao={{
                titulo: 'Remover o logo',
                descricao: 'O site fica sem logo no topo e no rodapé até você enviar outro. Vale depois de salvar.',
              }}
            />
            <p className="text-sm text-muted-foreground">
              Ao enviar um logo novo, as cores do site são tiradas dele. Confira as cores abaixo antes de salvar.
            </p>
          </div>

          <div className="space-y-3">
            <div className="max-w-xs">
              <h3 className="text-sm font-medium">Ícone da aba</h3>
              <p className="text-sm text-muted-foreground">
                Aparece na aba do navegador, ao lado do nome do site. Use uma imagem quadrada, de preferência 512×512.
              </p>
            </div>
            <EnvioDeImagem
              rotulo="Ícone da aba"
              variante="icone"
              url={siteForm.favicon_url}
              enviar={enviarIcone}
              aoRemover={() => setF({ favicon_url: null })}
              confirmacao={{
                titulo: 'Remover o ícone da aba',
                descricao: 'O navegador volta a mostrar um ícone padrão na aba do site. Vale depois de salvar.',
              }}
            />
            <PreviaDaAba icone={siteForm.favicon_url} nome={siteForm.name} />
          </div>
        </div>
      </Secao>

      <Secao
        titulo="Cores"
        descricao="As cores dos botões, títulos e destaques do site. Saem do logo quando você envia um novo, e você pode trocar aqui."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <CampoDeCor id="aparencia-cor-principal" rotulo="Cor principal" ajuda="Botões, links e a faixa do topo."
            valor={siteForm.primary_color ?? ''} padrao="#7C3AED" aoMudar={primary_color => setF({ primary_color })} />
          <CampoDeCor id="aparencia-cor-destaque" rotulo="Cor de destaque" ajuda="Selos e detalhes que chamam a atenção."
            valor={siteForm.accent_color ?? ''} padrao="#9333EA" aoMudar={accent_color => setF({ accent_color })} />
        </div>
      </Secao>

      <Secao titulo="Fonte" descricao="O tipo de letra de todos os textos e títulos do site.">
        <Campo id="site-font" rotulo="Fonte do site" className="max-w-md">
          <Seletor
            id="site-font"
            value={siteForm.font_family ?? 'Inter'}
            onChange={e => setF({ font_family: e.target.value })}
            className={`w-full rounded-md border border-input bg-background px-3 ${CLASSE_DO_CAMPO}`}
            style={{ fontFamily: `${siteForm.font_family ?? 'Inter'}, system-ui, sans-serif` }}
          >
            {SITE_FONTS.map(f => (
              <option key={f} value={f} style={{ fontFamily: `${f}, system-ui, sans-serif` }}>{f}</option>
            ))}
          </Seletor>
        </Campo>
      </Secao>

      {/* Banner da home: a FOTO (automática, de um imóvel ou enviada) e o vídeo,
          que quando preenchido passa por cima da foto. */}
      <Secao
        titulo="Banner da página inicial"
        descricao="A imagem grande que ocupa o topo da página inicial do site. Com vídeo preenchido, o vídeo passa por cima da foto."
      >
        {(() => {
          const choice = siteForm.hero_image ?? EMPTY_HERO_IMAGE;
          const resolved = site?.hero_image;
          const savedMatches = resolved?.mode === 'property'
            && resolved.property_id === choice.property_id
            && (choice.photo_id ?? null) === (resolved.photo_id ?? null);
          // Prévia: a foto recém-escolhida (ainda não salva) ou a que o servidor serve hoje.
          const propertyPreviewUrl = heroPickPreview?.url ?? (savedMatches ? resolved?.url : null);
          const propertyTitle = heroPickPreview?.property_title ?? (savedMatches ? resolved?.property?.title : null);
          const warning = !heroPickPreview && savedMatches ? heroImageWarning(resolved) : null;
          const setMode = (mode: typeof choice.mode) => {
            setHeroPickPreview(null);
            if (mode === 'auto') setF({ hero_image: { mode: 'auto' } });
            else if (mode === 'upload') setF({ hero_image: { mode: 'upload', url: resolved?.mode === 'upload' ? resolved.url ?? '' : '' } });
            // Voltando ao modo imóvel, recupera a escolha já gravada (se houver).
            else setF({ hero_image: resolved?.mode === 'property' && resolved.property_id
              ? heroImageChoiceFrom(resolved)
              : { mode: 'property', property_id: null, photo_id: null } });
          };
          return (
            <div className="space-y-3">
              <p className="text-sm font-medium">Foto</p>
              <div className="flex flex-wrap gap-2">
                {(['auto', 'property', 'upload'] as const).map(mode => (
                  <label key={mode} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-base ${choice.mode === mode ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <input type="radio" name="hero-image-mode" checked={choice.mode === mode} onChange={() => setMode(mode)} />
                    {HERO_IMAGE_MODE_LABELS[mode]}
                  </label>
                ))}
              </div>

              {choice.mode === 'auto' && (
                <p className="text-sm text-muted-foreground">
                  O site usa a capa do primeiro imóvel da lista. Ela troca sozinha quando outro imóvel entra na frente.
                </p>
              )}

              {choice.mode === 'property' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => setHeroPickerOpen(true)}>
                      <ImageIcon className="mr-1.5 h-4 w-4" /> {choice.property_id ? 'Trocar a foto' : 'Escolher foto de um imóvel'}
                    </Button>
                    {propertyTitle && <span className="text-sm text-muted-foreground">Imóvel: {propertyTitle}</span>}
                  </div>
                  {!choice.property_id && (
                    <p className="text-sm text-amber-700">Nenhuma foto escolhida ainda. Até escolher, o site continua no automático.</p>
                  )}
                  {warning && <p className="text-sm text-amber-700">{warning}</p>}
                  {propertyPreviewUrl && (
                    <img src={propertyPreviewUrl} alt="" className="aspect-video w-full max-w-2xl rounded-lg border border-border object-cover" />
                  )}
                  <p className="text-sm text-muted-foreground">
                    Se o imóvel for despublicado ou excluído, o site volta ao automático e esta tela avisa.
                  </p>
                </div>
              )}

              {choice.mode === 'upload' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={choice.url ?? ''} onChange={e => setF({ hero_image: { mode: 'upload', url: e.target.value } })}
                      aria-label="Endereço da foto do banner"
                      placeholder="https://... ou envie o arquivo" className={`flex-1 ${CLASSE_DO_CAMPO}`} />
                    <input ref={heroImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleHeroImageFile} />
                    <Button type="button" variant="outline" onClick={() => heroImageInputRef.current?.click()}
                      disabled={heroImageUploading} className="h-11 flex-none">
                      {heroImageUploading
                        ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Enviando...</>
                        : <><Upload className="mr-1.5 h-4 w-4" /> Enviar foto</>}
                    </Button>
                  </div>
                  {choice.url
                    ? <img src={choice.url} alt="" className="aspect-video w-full max-w-2xl rounded-lg border border-border object-cover" />
                    : <p className="text-sm text-amber-700">Sem foto enviada, o site continua no automático.</p>}
                </div>
              )}
            </div>
          );
        })()}

        <HeroImagePicker
          open={heroPickerOpen}
          onClose={() => setHeroPickerOpen(false)}
          onPick={handleHeroPick}
          currentPropertyId={siteForm.hero_image?.property_id}
          currentPhotoId={siteForm.hero_image?.photo_id}
        />

        <Campo id="aparencia-video" rotulo="Vídeo (opcional)"
          ajuda="MP4 ou WebM, até 60 MB. Toca no fundo do banner, sem som e repetindo, por cima da foto.">
          <div className="flex items-center gap-2">
            <Input id="aparencia-video" value={siteForm.hero_video_url ?? ''} onChange={e => setF({ hero_video_url: e.target.value })}
              placeholder="https://... ou envie o arquivo" className={`flex-1 ${CLASSE_DO_CAMPO}`}
              aria-describedby="aparencia-video-ajuda" />
            <input ref={bannerVideoInputRef} type="file" accept="video/mp4,video/webm,video/*" className="hidden" onChange={handleBannerVideoFile} />
            <Button type="button" variant="outline" onClick={() => bannerVideoInputRef.current?.click()}
              disabled={bannerVideoUploading} className="h-11 flex-none">
              {bannerVideoUploading
                ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Enviando...</>
                : <><Upload className="mr-1.5 h-4 w-4" /> Enviar vídeo</>}
            </Button>
            {siteForm.hero_video_url && (
              <Button type="button" variant="ghost" size="icon" title="Remover vídeo" aria-label="Remover vídeo"
                className="h-11 w-11 flex-none text-destructive hover:text-destructive"
                onClick={() => setF({ hero_video_url: '' })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Campo>
        {siteForm.hero_video_url && (
          <video key={siteForm.hero_video_url} src={siteForm.hero_video_url} muted loop autoPlay playsInline
            className="aspect-video w-full max-w-2xl rounded-lg border border-border object-cover" />
        )}
      </Secao>

      {/* Seções da home — liga/desliga blocos do portal. Nem toda imobiliária
          tem imóveis/cidades suficientes pra faixa de números fazer sentido. */}
      <Secao
        titulo="Blocos da página inicial"
        descricao="Ligue ou desligue partes da página inicial. Desligado, o bloco some do site. Vitrines, chamadas e mais buscados têm a própria tela em Personalizar."
      >
        <div className="divide-y divide-border">
          {[
            {
              key: 'stats' as const,
              title: 'Faixa de números',
              desc: 'Ex.: "5 imóveis disponíveis", "2 cidades atendidas", "24h no WhatsApp".',
            },
            {
              key: 'lead_capture' as const,
              title: 'Captura de lead',
              desc: 'Bloco "Não achou? A gente encontra pra você" com formulário de contato.',
            },
          ].map(s => (
            <div key={s.key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="text-base font-medium">{s.title}</div>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
              <Checkbox
                id={`secao-${s.key}`}
                aria-label={s.title}
                checked={siteForm.sections?.[s.key] ?? true}
                onCheckedChange={checked =>
                  setF({ sections: { ...siteForm.sections, [s.key]: checked === true } })
                }
              />
            </div>
          ))}
        </div>
      </Secao>
    </Secoes>
  );
}

interface CampoDeCorProps {
  id: string;
  rotulo: string;
  ajuda: string;
  valor: string;
  padrao: string;
  aoMudar: (valor: string) => void;
}

function CampoDeCor({ id, rotulo, ajuda, valor, padrao, aoMudar }: CampoDeCorProps) {
  return (
    <Campo id={id} rotulo={rotulo} ajuda={ajuda}>
      <div className="flex items-center gap-2">
        <input type="color" value={valor || padrao} onChange={e => aoMudar(e.target.value)}
          aria-label={`Escolher a ${rotulo.toLowerCase()}`}
          className="h-11 w-16 flex-none cursor-pointer rounded-md border border-input" />
        <Input id={id} value={valor} onChange={e => aoMudar(e.target.value)} placeholder={padrao}
          aria-describedby={`${id}-ajuda`} className={`flex-1 font-mono ${CLASSE_DO_CAMPO}`} />
      </div>
    </Campo>
  );
}

// Como o site aparece na aba do navegador: o ícone (ou o genérico, sem ícone) e o
// nome do site cortado, igual o navegador faz.
function PreviaDaAba({ icone, nome }: { icone: string | null | undefined; nome: string }) {
  return (
    <figure className="max-w-[280px] space-y-2">
      <div className="rounded-t-lg bg-zinc-200/70 px-2 pt-2 dark:bg-zinc-800">
        <div data-testid="previa-da-aba"
          className="flex h-9 items-center gap-2 rounded-t-lg bg-white px-3 text-sm text-zinc-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-200">
          {icone
            ? <img src={icone} alt="" className="h-4 w-4 flex-none object-contain" />
            : <Globe className="h-4 w-4 flex-none text-zinc-400" aria-hidden />}
          <span className="min-w-0 flex-1 truncate">{nome.trim() || 'Seu site'}</span>
          <X className="h-3.5 w-3.5 flex-none text-zinc-400" aria-hidden />
        </div>
      </div>
      <figcaption className="text-xs text-muted-foreground">
        {icone ? 'Assim o site aparece na aba do navegador.' : 'Sem ícone, o navegador mostra um ícone padrão.'}
      </figcaption>
    </figure>
  );
}
