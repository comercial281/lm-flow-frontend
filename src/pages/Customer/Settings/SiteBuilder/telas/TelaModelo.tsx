import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { APARENCIA_FABRICA, CORES_DO_FUNDO, textoSobre } from '@/features/siteBuilder/public/aparenciaConfig';
import { HOME_FABRICA } from '@/features/siteBuilder/public/homeConfig';
import { LISTA_FABRICA } from '@/features/siteBuilder/public/listaConfig';
import {
  MODELOS_DO_SITE, aplicarModelo, modeloAtual, type EstadoDoVisual, type ModeloDoSite, type ModeloDoSiteId,
} from '@/features/siteBuilder/modelosDoSite';
import type { FormProps } from './tipos';

const COR_PRINCIPAL_PADRAO = '#1F3A5F';
const COR_DESTAQUE_PADRAO = '#C9A24B';

// Miniatura em HTML/CSS (não é imagem): topo, capa e 3 cartões no estilo do modelo,
// pintados com as cores do próprio cliente.
function Miniatura({ id, principal, destaque }: { id: ModeloDoSiteId; principal: string; destaque: string }) {
  const { appearance: ap } = aplicarModelo(id, { font_family: null, appearance: APARENCIA_FABRICA, home: HOME_FABRICA, listing: LISTA_FABRICA });
  const cores = CORES_DO_FUNDO[ap.background];
  const topoNaCor = ap.header_style === 'brand';
  const dividida = ap.hero_layout === 'split';
  const grande = ap.card_style === 'large';
  const linhaDoMenu = textoSobre(principal) === '#FFFFFF' ? 'bg-white/70' : 'bg-black/60';
  return (
    <div data-testid="miniatura" aria-hidden className="overflow-hidden rounded-lg border border-border"
      style={{ background: cores.paper }}>
      <div className="flex h-5 items-center justify-between px-2" style={{ background: topoNaCor ? principal : cores.card }}>
        <span className="h-2 w-8 rounded-sm" style={{ background: topoNaCor ? '#FFFFFF' : principal }} />
        <span className="flex gap-1">
          {[0, 1, 2].map(i => (
            <span key={i} className={`h-1 rounded-sm ${topoNaCor ? linhaDoMenu : ''} ${ap.menu_style === 'caps' ? 'w-3' : 'w-4'}`}
              style={topoNaCor ? undefined : { background: cores.ink, opacity: 0.5 }} />
          ))}
        </span>
      </div>
      <div className={`flex ${ap.hero_height === 'full' ? 'h-20' : 'h-14'}`}
        style={{ background: dividida ? cores.paper : `linear-gradient(180deg, ${principal}, ${principal}CC)` }}>
        {dividida ? (
          <>
            <div className="flex w-1/2 flex-col justify-center gap-1 px-2">
              <span className="h-1.5 w-4/5 rounded-sm" style={{ background: cores.ink }} />
              <span className="h-1.5 w-3/5 rounded-sm" style={{ background: cores.ink, opacity: 0.6 }} />
              <span className="mt-1 h-3 w-full rounded-sm" style={{ background: cores.card, border: `1px solid ${destaque}` }} />
            </div>
            <div className="w-1/2" style={{ background: `linear-gradient(135deg, ${principal}, ${destaque})` }} />
          </>
        ) : (
          <div className="flex w-full flex-col items-center justify-center gap-1">
            <span className="h-1.5 w-2/5 rounded-sm bg-white/90" />
            <span className="h-3 w-3/5 rounded-sm bg-white/90" />
          </div>
        )}
      </div>
      <div className={`grid gap-1.5 p-2 ${grande ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {(grande ? [0, 1] : [0, 1, 2]).map(i => (
          <div key={i} className="overflow-hidden rounded-sm" style={{ background: cores.card }}>
            <div className={grande ? 'h-9' : 'h-6'} style={{ background: i === 0 ? destaque : principal, opacity: i === 0 ? 1 : 0.55 }} />
            <div className="space-y-0.5 p-1">
              <span className="block h-1 w-4/5 rounded-sm" style={{ background: cores.ink, opacity: 0.7 }} />
              <span className="block h-1 w-2/5 rounded-sm" style={{ background: principal }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// "Modelo do site": três pontos de partida pro visual. Só grava no formulário (o Salvar é que
// manda pro ar) e só mexe no visual; cores, logo, textos, vitrines, busca e menu ficam como estão.
export default function TelaModelo({ siteForm, setF }: FormProps) {
  const estado: EstadoDoVisual = {
    font_family: siteForm.font_family ?? null,
    appearance: siteForm.appearance ?? APARENCIA_FABRICA,
    home: siteForm.home ?? HOME_FABRICA,
    listing: siteForm.listing ?? LISTA_FABRICA,
  };
  const emUso = modeloAtual(estado);
  const principal = siteForm.primary_color || COR_PRINCIPAL_PADRAO;
  const destaque = siteForm.accent_color || COR_DESTAQUE_PADRAO;
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const usar = async (m: ModeloDoSite) => {
    const ok = await confirmar({
      titulo: `Usar o modelo ${m.nome}?`,
      descricao: 'Muda a fonte, o fundo, o topo, a capa, o menu e os cartões. Suas cores, logo, textos, vitrines e menu continuam iguais. Nada vai pro ar antes de você clicar em Salvar.',
      rotuloDaAcao: 'Usar este modelo',
    });
    if (!ok) return;
    setF(aplicarModelo(m.id, estado));
    toast.success('Modelo aplicado. Confira em Ver prévia e clique em Salvar.');
  };

  return (
    <>
      <div className="grid gap-5 md:grid-cols-3">
        {MODELOS_DO_SITE.map(m => (
          <div key={m.id} role="group" aria-label={m.nome}
            className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
            <Miniatura id={m.id} principal={principal} destaque={destaque} />
            <div className="flex-1 space-y-1">
              <h3 className="text-base font-semibold">{m.nome}</h3>
              <p className="text-sm text-muted-foreground">{m.frase}</p>
            </div>
            {emUso === m.id ? (
              <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                <Check className="h-4 w-4" aria-hidden /> Em uso
              </p>
            ) : (
              <Button type="button" variant="outline" onClick={() => usar(m)}>Usar este modelo</Button>
            )}
          </div>
        ))}
      </div>
      {dialogoDeConfirmacao}
    </>
  );
}
