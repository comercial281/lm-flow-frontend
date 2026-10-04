import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button, Checkbox, Label as UILabel } from '@/components/ui/ds';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { estiloDaMarca } from '@/features/siteBuilder/watermarkPreview';
import { siteBuilderService, type Site, type SiteWatermark } from '@/services/siteBuilder/siteBuilderService';
import { propertiesService } from '@/services/properties/propertiesService';
import { Secao, Secoes } from '../ui/Secao';
import type { FormProps } from './tipos';

type Posicao = SiteWatermark['position'];

const POSICOES: { id: Posicao; rotulo: string; ponto: string }[] = [
  { id: 'top_left', rotulo: 'Canto superior esquerdo', ponto: 'left-1 top-1' },
  { id: 'top_right', rotulo: 'Canto superior direito', ponto: 'right-1 top-1' },
  { id: 'center', rotulo: 'Centro', ponto: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' },
  { id: 'bottom_left', rotulo: 'Canto inferior esquerdo', ponto: 'left-1 bottom-1' },
  { id: 'bottom_right', rotulo: 'Canto inferior direito', ponto: 'right-1 bottom-1' },
];

const PADRAO: Omit<SiteWatermark, 'logo_url'> = { enabled: false, position: 'center', opacity: 60 };

interface Props extends FormProps {
  // O logo é salvo na hora e só atualiza o `site` do pai: o formulário (com
  // edições ainda não salvas em outras telas) não é tocado.
  onLogoAtualizado: (site: Site) => void;
}

// Foto real para o preview: a capa de um imóvel publicado no site (ou, sem
// nenhum publicado, o primeiro com capa). Sem foto ou com erro: quadro cinza.
function useFotoDeExemplo(): string | null {
  const [foto, setFoto] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    propertiesService.list({ status: 'active', per_page: 20, sort: 'recent' })
      .then(({ data }) => {
        const capa = data.find(p => p.published_on_site && p.cover_photo_url) ?? data.find(p => p.cover_photo_url);
        if (vivo) setFoto(capa?.cover_photo_url ?? null);
      })
      .catch(() => { /* fica o quadro cinza */ });
    return () => { vivo = false; };
  }, []);
  return foto;
}

export default function TelaMarcaDagua({ site, siteForm, setF, onLogoAtualizado }: Props) {
  const fotoExemplo = useFotoDeExemplo();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  const marca = { ...PADRAO, ...siteForm.watermark };
  const logoUrl = site?.watermark?.logo_url ?? null;
  const atualizar = (parcial: Partial<typeof marca>) => setF({ watermark: { ...marca, ...parcial } });

  const enviar = async (file: File | undefined) => {
    if (!file || !site) return;
    setEnviando(true);
    try {
      onLogoAtualizado(await siteBuilderService.uploadWatermarkLogo(site.id, file));
      toast.success('Logo enviado');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível enviar o logo'));
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remover = async () => {
    if (!site) return;
    const ok = await confirmar({
      titulo: 'Remover logo',
      descricao: 'Remover o logo da marca d\'água? As fotos do site voltam sem marca.',
      rotuloDaAcao: 'Remover',
      destrutivo: true,
    });
    if (!ok) return;
    try {
      onLogoAtualizado(await siteBuilderService.removeWatermarkLogo(site.id));
      toast.success('Logo removido');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível remover o logo'));
    }
  };

  return (
    <Secoes>
      <Secao
        titulo="Logo nas fotos"
        descricao="Seu logo por cima das fotos dos imóveis, no site e nas páginas de anúncio, para ninguém usar as fotos sem pedir. Os portais (ZAP, OLX…) continuam recebendo a foto sem marca."
      >
      <div className="flex items-center gap-3">
        <Checkbox id="marca-ativa" checked={marca.enabled}
          onCheckedChange={v => atualizar({ enabled: v === true })} />
        <UILabel htmlFor="marca-ativa" className="cursor-pointer text-base font-normal">Colocar marca d'água nas fotos dos imóveis</UILabel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
          {fotoExemplo ? (
            <img src={fotoExemplo} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">Foto de exemplo</div>
          )}
          {logoUrl && marca.enabled && (
            <img src={logoUrl} alt="" style={estiloDaMarca(marca.position, marca.opacity)} />
          )}
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <UILabel>Logo</UILabel>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              aria-label="Escolher arquivo do logo" onChange={e => enviar(e.target.files?.[0])} />
            <div className="flex items-center gap-3">
              {logoUrl && (
                <img src={logoUrl} alt="Logo atual" className="h-12 w-12 rounded-md border border-border bg-muted object-contain" />
              )}
              <Button type="button" variant="outline" size="sm" disabled={enviando || !site}
                onClick={() => inputRef.current?.click()}>
                {logoUrl ? 'Trocar' : 'Enviar logo'}
              </Button>
              {logoUrl && (
                <Button type="button" variant="ghost" size="sm" disabled={enviando} onClick={remover}>Remover</Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Use o logo branco ou com fundo transparente (PNG). É salvo na hora.</p>
          </div>

          <div className="space-y-2">
            <UILabel>Posição</UILabel>
            <div className="flex flex-wrap gap-2">
              {POSICOES.map(p => (
                <button key={p.id} type="button" aria-label={p.rotulo} title={p.rotulo}
                  aria-pressed={marca.position === p.id} onClick={() => atualizar({ position: p.id })}
                  className={`relative h-12 w-16 rounded-md border bg-muted ${marca.position === p.id ? 'border-primary ring-2 ring-primary/40' : 'border-border'}`}>
                  <span className={`absolute h-2.5 w-2.5 rounded-full bg-foreground ${p.ponto}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <UILabel htmlFor="marca-opacidade">Transparência · {marca.opacity}%</UILabel>
            <input id="marca-opacidade" type="range" min={10} max={100} step={5} value={marca.opacity}
              onChange={e => atualizar({ opacity: Number(e.target.value) })} className="w-full" />
          </div>
        </div>
      </div>

      {dialogoDeConfirmacao}
      </Secao>
    </Secoes>
  );
}
