import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { Button, Checkbox, Input, Label as UILabel } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { siteBuilderService, type SitePage } from '@/services/siteBuilder/siteBuilderService';
import {
  HOME_FABRICA, TEXTO_FABRICA, type ChamadaLivre, type ChamadaPadrao, type ChamadaPadraoId, type HomeConfig,
} from '@/features/siteBuilder/public/homeConfig';
import type { FormProps } from './tipos';

// Teto do servidor (Sites::HomeConfig::MAX_CUSTOM_CALLOUTS).
const MAX_LIVRES = 3;
const LINK_VALIDO = /^https?:\/\/\S+$/i;
const ERRO_LINK = 'Use um endereço que comece com https://';

type Callouts = HomeConfig['callouts'];

const VISUAIS: { id: Callouts['layout']; rotulo: string }[] = [
  { id: 'band', rotulo: 'Faixa' },
  { id: 'photo', rotulo: 'Faixa com foto' },
  { id: 'cards', rotulo: 'Cartões' },
];

const PRONTAS: { id: ChamadaPadraoId; destino: string }[] = [
  { id: 'financing', destino: 'Leva pra página Financiamento — ligue em Personalizar › Financiamento.' },
  { id: 'listing', destino: 'Leva pra página Anuncie seu imóvel — ligue em Personalizar › Anuncie seu imóvel.' },
  { id: 'wanted', destino: 'Leva pro formulário de contato da página inicial.' },
];

const CHAMADA_NOVA: ChamadaLivre = { title: '', text: null, button: null, dest_type: 'page', dest_value: null };

const texto = (v: string) => (v.trim() === '' ? null : v);

export default function TelaChamadas({ site, siteForm, setF }: FormProps) {
  const home: HomeConfig = siteForm.home ?? HOME_FABRICA;
  const c = home.callouts;
  // Sempre o objeto `home` inteiro: o servidor troca cada bloco recebido por completo.
  const mudar = (parte: Partial<Callouts>) => setF({ home: { ...home, callouts: { ...c, ...parte } } });
  const mudarPronta = (id: ChamadaPadraoId, parte: Partial<ChamadaPadrao>) =>
    mudar({ defaults: { ...c.defaults, [id]: { ...c.defaults[id], ...parte } } });
  const mudarLivre = (i: number, parte: Partial<ChamadaLivre>) =>
    mudar({ custom: c.custom.map((x, k) => (k === i ? { ...x, ...parte } : x)) });

  const [paginas, setPaginas] = useState<SitePage[]>([]);
  const siteId = site?.id;
  useEffect(() => {
    if (!siteId) return;
    let vivo = true;
    // Landing de anúncio não é página do site: não entra no menu.
    siteBuilderService.listPages(siteId)
      .then(lista => { if (vivo) setPaginas(lista.filter(p => p.page_kind !== 'ad_landing')); })
      .catch(() => { if (vivo) setPaginas([]); });
    return () => { vivo = false; };
  }, [siteId]);

  // Foto de fundo do visual "Faixa com foto" (mesmo molde da foto da capa em Aparência).
  const fotoRef = useRef<HTMLInputElement | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enviarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fotoRef.current) fotoRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Envie um arquivo de imagem (JPG, PNG ou WebP).'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('Imagem muito grande (máx 8MB). Comprima antes de enviar.'); return; }
    setEnviando(true);
    try {
      const { url } = await siteBuilderService.uploadAsset(file);
      mudar({ background_url: url });
      toast.success('Foto enviada. Clique em Salvar para publicar.');
    } catch {
      toast.error('Falha no envio da foto.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-base font-semibold">Visual</h2>
        <div role="group" aria-label="Visual" className="flex flex-wrap gap-3">
          {VISUAIS.map(v => (
            <button key={v.id} type="button" aria-pressed={c.layout === v.id} onClick={() => mudar({ layout: v.id })}
              className={`w-36 rounded-lg border p-2 text-left text-sm ${c.layout === v.id ? 'border-primary ring-2 ring-primary/40' : 'border-border'}`}>
              <Miniatura visual={v.id} />
              <span className="mt-2 block">{v.rotulo}</span>
            </button>
          ))}
        </div>

        {c.layout === 'photo' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {c.background_url && (
                <img src={c.background_url} alt="" className="h-14 w-24 flex-none rounded border border-border object-cover" />
              )}
              <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={enviarFoto} />
              <Button type="button" variant="outline" disabled={enviando} onClick={() => fotoRef.current?.click()}>
                {enviando
                  ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> Enviando...</>
                  : <><Upload className="mr-1.5 h-4 w-4" aria-hidden /> {c.background_url ? 'Trocar foto' : 'Enviar foto'}</>}
              </Button>
              {c.background_url && (
                <Button type="button" variant="ghost" onClick={() => mudar({ background_url: null })}>
                  <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> Tirar foto
                </Button>
              )}
            </div>
            {!c.background_url && <p className="text-sm text-muted-foreground">Sem foto, a faixa sai escura, como no visual Faixa.</p>}
            <div className="space-y-2">
              <UILabel htmlFor="chamadas-escurecer">Escurecer a foto · {c.overlay}%</UILabel>
              <input id="chamadas-escurecer" type="range" min={0} max={80} step={5} value={c.overlay}
                onChange={e => mudar({ overlay: Number(e.target.value) })} className="w-full" />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-base font-semibold">Chamadas prontas</h2>
        {PRONTAS.map(({ id, destino }) => {
          const p = c.defaults[id];
          const f = TEXTO_FABRICA[id];
          return (
            <fieldset key={id} className="rounded-lg border border-border p-3 space-y-3">
              <legend className="px-1 text-sm font-medium">{f.title}</legend>
              <div className="flex items-center gap-2">
                <Checkbox id={`pronta-${id}-mostrar`} checked={p.enabled} onCheckedChange={v => mudarPronta(id, { enabled: v === true })} />
                <UILabel htmlFor={`pronta-${id}-mostrar`} className="cursor-pointer">Mostrar</UILabel>
              </div>
              <CamposDeTexto idBase={`pronta-${id}`} titulo={p.title ?? ''} texto={p.text ?? ''} botao={p.button ?? ''}
                dicas={f} mudar={(campo, v) => mudarPronta(id, { [campo]: texto(v) })} />
              <p className="text-sm text-muted-foreground">{destino}</p>
            </fieldset>
          );
        })}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-base font-semibold">Suas chamadas</h2>
        {c.custom.length === 0 && <p className="text-sm text-muted-foreground">Até 3 chamadas suas, pra uma página, um link ou o WhatsApp.</p>}
        {c.custom.map((x, i) => (
          <fieldset key={i} className="rounded-lg border border-border p-3 space-y-3">
            <legend className="px-1 text-sm font-medium">Chamada {i + 1}</legend>
            <CamposDeTexto idBase={`livre-${i}`} titulo={x.title} texto={x.text ?? ''} botao={x.button ?? ''}
              dicas={{ title: '', text: '', button: 'Saiba mais' }}
              // Nas livres o título é obrigatório: fica texto (vazio a chamada não é salva).
              mudar={(campo, v) => mudarLivre(i, campo === 'title' ? { title: v } : { [campo]: texto(v) })} />
            {x.title.trim() === '' && <p className="text-sm text-amber-600">Sem título, a chamada não é salva.</p>}
            <Destino idBase={`livre-${i}`} chamada={x} paginas={paginas} temZap={!!siteForm.contact_whatsapp?.trim()}
              mudar={parte => mudarLivre(i, parte)} />
            <Button type="button" variant="ghost" size="sm" onClick={() => mudar({ custom: c.custom.filter((_, k) => k !== i) })}>
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> Remover
            </Button>
          </fieldset>
        ))}
        {c.custom.length < MAX_LIVRES && (
          <Button type="button" variant="outline" onClick={() => mudar({ custom: [...c.custom, { ...CHAMADA_NOVA }] })}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Nova chamada
          </Button>
        )}
      </section>

      <p className="text-sm text-muted-foreground">A faixa aparece com pelo menos 2 chamadas ligadas.</p>
    </>
  );
}

function Miniatura({ visual }: { visual: Callouts['layout'] }) {
  if (visual === 'cards') {
    return (
      <span aria-hidden className="flex h-12 items-center justify-center gap-1 rounded bg-muted px-1.5">
        {[0, 1, 2].map(k => <span key={k} className="h-8 flex-1 rounded-sm border border-border bg-white" />)}
      </span>
    );
  }
  return (
    <span aria-hidden className={`flex h-12 items-center justify-around rounded px-2 ${visual === 'photo'
      ? 'bg-gradient-to-br from-sky-700 via-emerald-700 to-stone-800' : 'bg-zinc-900'}`}>
      {[0, 1, 2].map(k => <span key={k} className="h-2.5 w-2.5 rounded-full bg-white/80" />)}
    </span>
  );
}

interface CamposProps {
  idBase: string;
  titulo: string;
  texto: string;
  botao: string;
  dicas: { title: string; text: string; button: string };
  /** Texto cru do campo; quem chama decide se vazio vira null (= texto de fábrica). */
  mudar: (campo: 'title' | 'text' | 'button', valor: string) => void;
}

// Limites do servidor: título 60, texto 200, botão 40.
function CamposDeTexto({ idBase, titulo, texto: valorTexto, botao, dicas, mudar }: CamposProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <UILabel htmlFor={`${idBase}-titulo`}>Título</UILabel>
        <Input id={`${idBase}-titulo`} className="mt-1" maxLength={60} value={titulo} placeholder={dicas.title}
          onChange={e => mudar('title', e.target.value)} />
      </div>
      <div>
        <UILabel htmlFor={`${idBase}-botao`}>Botão</UILabel>
        <Input id={`${idBase}-botao`} className="mt-1" maxLength={40} value={botao} placeholder={dicas.button}
          onChange={e => mudar('button', e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <UILabel htmlFor={`${idBase}-texto`}>Texto</UILabel>
        <Input id={`${idBase}-texto`} className="mt-1" maxLength={200} value={valorTexto} placeholder={dicas.text}
          onChange={e => mudar('text', e.target.value)} />
      </div>
    </div>
  );
}

interface DestinoProps {
  idBase: string;
  chamada: ChamadaLivre;
  paginas: SitePage[];
  temZap: boolean;
  mudar: (parte: Partial<ChamadaLivre>) => void;
}

function Destino({ idBase, chamada: x, paginas, temZap, mudar }: DestinoProps) {
  const escolhida = paginas.find(p => p.slug === x.dest_value);
  // A página gravada pode ter sido excluída: continua na lista pra não sumir em silêncio.
  const semPagina = x.dest_type === 'page' && !!x.dest_value && !escolhida;

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <UILabel htmlFor={`${idBase}-destino`}>Destino</UILabel>
          <Seletor id={`${idBase}-destino`} className="mt-1 w-full" value={x.dest_type}
            onChange={e => mudar({ dest_type: e.target.value as ChamadaLivre['dest_type'], dest_value: null })}>
            <option value="page">Uma página do site</option>
            <option value="url">Um link</option>
            <option value="whatsapp">O WhatsApp do site</option>
          </Seletor>
        </div>
        {x.dest_type === 'page' && (
          <div>
            <UILabel htmlFor={`${idBase}-pagina`}>Página</UILabel>
            <Seletor id={`${idBase}-pagina`} className="mt-1 w-full" value={x.dest_value ?? ''}
              onChange={e => mudar({ dest_value: e.target.value || null })}>
              <option value="">Escolha uma página</option>
              {paginas.map(p => <option key={p.id} value={p.slug}>{p.title}</option>)}
              {semPagina && <option value={x.dest_value!}>Página excluída</option>}
            </Seletor>
          </div>
        )}
        {x.dest_type === 'url' && (
          <CampoLink id={`${idBase}-link`} valor={x.dest_value} mudar={dest_value => mudar({ dest_value })} />
        )}
      </div>

      {x.dest_type === 'page' && paginas.length === 0 && (
        <p className="text-sm text-muted-foreground">Você ainda não tem páginas. Crie em Personalizar › Páginas.</p>
      )}
      {x.dest_type === 'page' && !x.dest_value && paginas.length > 0 && (
        <p className="text-sm text-amber-600">Sem página escolhida, a chamada não é salva.</p>
      )}
      {x.dest_type === 'page' && (semPagina || (escolhida && (!escolhida.active || !escolhida.in_menu))) && (
        <p className="text-sm text-amber-600">
          Essa página não está no menu do site: a chamada só aparece quando ela estiver ativa e com Exibir no menu marcado, em Personalizar › Páginas.
        </p>
      )}
      {x.dest_type === 'whatsapp' && (
        <>
          <p className="text-sm text-muted-foreground">Usa o WhatsApp de Dados de contato.</p>
          {!temZap && (
            <p className="text-sm text-amber-600">
              O site ainda não tem WhatsApp: a chamada só aparece depois que você preencher em Configurações › Dados de contato.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// Enquanto a pessoa digita "https://" não é erro; endereço que não começa assim é
// avisado na hora e não é gravado (o servidor descartaria a chamada em silêncio).
function CampoLink({ id, valor, mudar }: { id: string; valor: string | null; mudar: (v: string | null) => void }) {
  const [digitado, setDigitado] = useState(valor ?? '');
  const [saiu, setSaiu] = useState(false);
  // Valor trocado por fora (chamada de cima removida, home relido do servidor): o campo acompanha.
  const [anterior, setAnterior] = useState(valor);
  if (valor !== anterior) {
    setAnterior(valor);
    const atual = LINK_VALIDO.test(digitado.trim()) ? digitado.trim() : null;
    if (atual !== valor) setDigitado(valor ?? '');
  }
  const limpo = digitado.trim();
  const valido = LINK_VALIDO.test(limpo);
  const comecando = ['http://', 'https://'].some(p => p.startsWith(limpo.toLowerCase()));
  const erro = limpo !== '' && !valido && (saiu || !comecando);

  return (
    <div>
      <UILabel htmlFor={id}>Endereço</UILabel>
      <Input id={id} className="mt-1" inputMode="url" value={digitado} placeholder="https://"
        aria-invalid={erro} aria-describedby={erro ? `${id}-erro` : undefined}
        onBlur={() => setSaiu(true)}
        onChange={e => {
          const v = e.target.value;
          setDigitado(v);
          const novo = LINK_VALIDO.test(v.trim()) ? v.trim() : null;
          if (novo !== valor) mudar(novo);
        }} />
      {erro && <p id={`${id}-erro`} className="mt-1 text-sm text-destructive">{ERRO_LINK}</p>}
    </div>
  );
}
