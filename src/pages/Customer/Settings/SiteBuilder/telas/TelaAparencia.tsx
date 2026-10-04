import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button, Checkbox, Input, Label as UILabel } from '@/components/ui/ds';
import { Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { extractLogoColors } from '@/utils/logoColors';
import { siteBuilderService } from '@/services/siteBuilder/siteBuilderService';
import HeroImagePicker, { type HeroImagePick } from '@/features/siteBuilder/HeroImagePicker';
import { EMPTY_HERO_IMAGE, HERO_IMAGE_MODE_LABELS, heroImageChoiceFrom, heroImageWarning } from '@/features/siteBuilder/heroImage';
import { Seletor } from '@/components/base/Seletor';
import type { FormProps } from './tipos';

const SITE_FONTS = ['Inter', 'Space Grotesk', 'Lato', 'Poppins', 'Montserrat', 'Roboto'];

interface Props extends FormProps {
  // A prévia da foto de imóvel recém-escolhida mora no pai: o Salvar a limpa.
  heroPickPreview: HeroImagePick | null;
  setHeroPickPreview: (pick: HeroImagePick | null) => void;
}

export default function TelaAparencia({ site, siteForm, setF, heroPickPreview, setHeroPickPreview }: Props) {
  // Logo upload + extração de cores (determinística, canvas)
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

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
  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (logoInputRef.current) logoInputRef.current.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('Logo muito grande (máx 8MB).'); return; }

    setLogoUploading(true);
    try {
      // Cores primeiro (arquivo local — funciona mesmo se o upload falhar).
      const colors = await extractLogoColors(file);
      const { url } = await siteBuilderService.uploadAsset(file);
      setF({
        logo_url: url,
        ...(colors ? { primary_color: colors.primary, accent_color: colors.accent } : {}),
      });
      toast.success(colors
        ? `Logo no ar. Cores extraídas: ${colors.primary} / ${colors.accent} — revise e salve.`
        : 'Logo no ar. Não achei cor de marca na imagem (P&B?) — cores mantidas.');
    } catch {
      toast.error('Falha no upload da logo.');
    } finally {
      setLogoUploading(false);
    }
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
    <div className="space-y-6">
      {/* Branding */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold mb-4">Identidade visual</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <UILabel>Logo</UILabel>
            <div className="mt-1 flex items-center gap-2">
              {siteForm.logo_url && (
                <img src={siteForm.logo_url} alt="logo"
                  className="h-9 w-9 rounded border border-border object-contain bg-white flex-none"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
              <Input value={siteForm.logo_url ?? ''} onChange={e => setF({ logo_url: e.target.value })}
                placeholder="https://... ou envie o arquivo" className="flex-1" />
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
              <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading} className="flex-none">
                {logoUploading
                  ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Enviando...</>
                  : <><Upload className="mr-1.5 h-4 w-4" /> Enviar logo</>}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Ao enviar a logo, as cores da marca abaixo são extraídas dela automaticamente.
            </p>
          </div>
          <div>
            <UILabel>Cor primária</UILabel>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={siteForm.primary_color ?? '#7C3AED'}
                onChange={e => setF({ primary_color: e.target.value })}
                className="h-9 w-14 rounded border border-input cursor-pointer" />
              <Input value={siteForm.primary_color ?? ''} onChange={e => setF({ primary_color: e.target.value })}
                placeholder="#7C3AED" className="font-mono flex-1" />
            </div>
          </div>
          <div>
            <UILabel>Cor de destaque</UILabel>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={siteForm.accent_color ?? '#9333EA'}
                onChange={e => setF({ accent_color: e.target.value })}
                className="h-9 w-14 rounded border border-input cursor-pointer" />
              <Input value={siteForm.accent_color ?? ''} onChange={e => setF({ accent_color: e.target.value })}
                placeholder="#9333EA" className="font-mono flex-1" />
            </div>
          </div>
          <div className="col-span-2">
            <UILabel htmlFor="site-font">Fonte</UILabel>
            <Seletor
              id="site-font"
              value={siteForm.font_family ?? 'Inter'}
              onChange={e => setF({ font_family: e.target.value })}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              style={{ fontFamily: `${siteForm.font_family ?? 'Inter'}, system-ui, sans-serif` }}
            >
              {SITE_FONTS.map(f => (
                <option key={f} value={f} style={{ fontFamily: `${f}, system-ui, sans-serif` }}>{f}</option>
              ))}
            </Seletor>
            <p className="mt-1 text-xs text-muted-foreground">
              Aplica-se a textos e títulos do site público.
            </p>
          </div>
        </div>
      </section>

      {/* Banner da home: a FOTO (automática, de um imóvel ou enviada) e o vídeo,
          que quando preenchido passa por cima da foto. */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold mb-1">Banner da home</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          A imagem que ocupa o topo do site. Com vídeo preenchido, o vídeo passa por cima da foto.
        </p>

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
            <div className="mb-5 space-y-3">
              <UILabel>Foto</UILabel>
              <div className="flex flex-wrap gap-2">
                {(['auto', 'property', 'upload'] as const).map(mode => (
                  <label key={mode} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${choice.mode === mode ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <input type="radio" name="hero-image-mode" checked={choice.mode === mode} onChange={() => setMode(mode)} />
                    {HERO_IMAGE_MODE_LABELS[mode]}
                  </label>
                ))}
              </div>

              {choice.mode === 'auto' && (
                <p className="text-xs text-muted-foreground">
                  O site usa a capa do primeiro imóvel da lista. Ela troca sozinha quando outro imóvel entra na frente.
                </p>
              )}

              {choice.mode === 'property' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => setHeroPickerOpen(true)}>
                      <ImageIcon className="mr-1.5 h-4 w-4" /> {choice.property_id ? 'Trocar a foto' : 'Escolher foto de um imóvel'}
                    </Button>
                    {propertyTitle && <span className="text-xs text-muted-foreground">Imóvel: {propertyTitle}</span>}
                  </div>
                  {!choice.property_id && (
                    <p className="text-xs text-amber-700">Nenhuma foto escolhida ainda. Até escolher, o site continua no automático.</p>
                  )}
                  {warning && <p className="text-xs text-amber-700">{warning}</p>}
                  {propertyPreviewUrl && (
                    <img src={propertyPreviewUrl} alt="" className="aspect-video w-full max-w-md rounded-lg border border-border object-cover" />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Se o imóvel for despublicado ou excluído, o site volta ao automático e esta tela avisa.
                  </p>
                </div>
              )}

              {choice.mode === 'upload' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={choice.url ?? ''} onChange={e => setF({ hero_image: { mode: 'upload', url: e.target.value } })}
                      placeholder="https://... ou envie o arquivo" className="flex-1" />
                    <input ref={heroImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleHeroImageFile} />
                    <Button type="button" variant="outline" onClick={() => heroImageInputRef.current?.click()}
                      disabled={heroImageUploading} className="flex-none">
                      {heroImageUploading
                        ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Enviando...</>
                        : <><Upload className="mr-1.5 h-4 w-4" /> Enviar foto</>}
                    </Button>
                  </div>
                  {choice.url
                    ? <img src={choice.url} alt="" className="aspect-video w-full max-w-md rounded-lg border border-border object-cover" />
                    : <p className="text-xs text-amber-700">Sem foto enviada, o site continua no automático.</p>}
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

        <UILabel>Vídeo (opcional)</UILabel>
        <p className="mb-2 mt-1 text-xs text-muted-foreground">
          MP4/WebM, máx 60MB. Toca como fundo do banner, sem som, em loop, por cima da foto.
        </p>
        <div className="flex items-center gap-2">
          <Input value={siteForm.hero_video_url ?? ''} onChange={e => setF({ hero_video_url: e.target.value })}
            placeholder="https://... ou envie o arquivo" className="flex-1" />
          <input ref={bannerVideoInputRef} type="file" accept="video/mp4,video/webm,video/*" className="hidden" onChange={handleBannerVideoFile} />
          <Button type="button" variant="outline" onClick={() => bannerVideoInputRef.current?.click()}
            disabled={bannerVideoUploading} className="flex-none">
            {bannerVideoUploading
              ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Enviando...</>
              : <><Upload className="mr-1.5 h-4 w-4" /> Enviar vídeo</>}
          </Button>
          {siteForm.hero_video_url && (
            <Button type="button" variant="ghost" size="icon" title="Remover vídeo"
              className="flex-none text-destructive hover:text-destructive"
              onClick={() => setF({ hero_video_url: '' })}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        {siteForm.hero_video_url && (
          <video key={siteForm.hero_video_url} src={siteForm.hero_video_url} muted loop autoPlay playsInline
            className="mt-3 aspect-video w-full max-w-md rounded-lg border border-border object-cover" />
        )}
      </section>

      {/* Seções da home — liga/desliga blocos do portal. Nem toda imobiliária
          tem imóveis/cidades suficientes pra faixa de números fazer sentido. */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold mb-1">Seções da home</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Ligue ou desligue blocos do portal. Desligado, o bloco some da home pública.
          {' '}Vitrines, chamadas e mais buscados têm a própria tela em Personalizar.
        </p>
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
            <div key={s.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="text-sm font-medium">{s.title}</div>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
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
      </section>
    </div>
  );
}
