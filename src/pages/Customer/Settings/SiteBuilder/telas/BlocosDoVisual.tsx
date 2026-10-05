import type { CSSProperties, ReactNode } from 'react';
import { siteBuilderService } from '@/services/siteBuilder/siteBuilderService';
import {
  CORES_DO_FUNDO, FILTRO_FABRICA, FILTRO_MAXIMO, TETO_TEXTO_RODAPE, TEXTO_RODAPE_FABRICA, contarCaracteres, cortarCaracteres,
  filtroDaCapa, textoSobre,
  type Aparencia, type AlturaDaCapa, type EstiloDoTopo, type FaixaDeCima, type Fundo, type LayoutDoRodape,
} from '@/features/siteBuilder/public/aparenciaConfig';
import { cn } from '@/lib/utils';
import { Secao } from '../ui/Secao';
import { CampoTextoLongo } from '../ui/Campo';
import EnvioDeImagem from '../ui/EnvioDeImagem';

// Os blocos da Aparência que mexem no visual do site (C3): fundo, topo, faixa
// de cima, altura e filtro do banner e rodapé. Cada um troca UMA chave de
// `appearance` e manda o objeto inteiro pro formulário (`mudar`). As frases
// dizem o que o site faz (portalShared.tsx, aparenciaConfig.ts); mudou o site,
// muda a frase.

export interface PropsDoBloco {
  ap: Aparencia;
  mudar: (parte: Partial<Aparencia>) => void;
}

interface Opcao<T extends string> {
  valor: T;
  nome: string;
  frase?: string;
  desenho: ReactNode;
}

/** Miniaturas clicáveis: um botão por opção, com `aria-pressed` na escolhida. */
export function Miniaturas<T extends string>({ rotulo, valor, opcoes, mudar }:
  { rotulo: string; valor: T; opcoes: Opcao<T>[]; mudar: (v: T) => void }) {
  return (
    <div role="group" aria-label={rotulo} className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
      {opcoes.map(o => {
        const escolhida = o.valor === valor;
        return (
          <button key={o.valor} type="button" aria-pressed={escolhida} onClick={() => mudar(o.valor)}
            className={cn(
              'flex flex-col gap-2 rounded-xl border-2 p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              escolhida ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
            )}>
            <span aria-hidden className="block h-20 w-full overflow-hidden rounded-md border border-border">{o.desenho}</span>
            <span className="px-1 text-sm font-medium">{o.nome}</span>
            {o.frase && <span className="px-1 text-xs text-muted-foreground">{o.frase}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Desenhos das miniaturas (só ilustração, `aria-hidden`) ──────────────── */

const linha = (cor: string, largura: string, extra?: CSSProperties) =>
  <span className="block h-1.5 rounded-full" style={{ background: cor, width: largura, ...extra }} />;

function PaginaMini({ fundo, topo, faixa, rodape, capa }: {
  fundo: string; topo?: ReactNode; faixa?: ReactNode; rodape?: ReactNode; capa?: ReactNode;
}) {
  return (
    <span className="flex h-full w-full flex-col" style={{ background: fundo }}>
      {faixa}
      {topo}
      {capa}
      <span className="flex-1" />
      {rodape}
    </span>
  );
}

const FOTO = 'linear-gradient(135deg, #9fb7c9 0%, #6f8aa0 50%, #c8b9a2 100%)';

/* ── Fundo ─────────────────────────────────────────────────────────────── */

export function BlocoFundo({ ap, mudar, temLogo }: PropsDoBloco & { temLogo: boolean }) {
  const desenho = (f: Fundo) => {
    const c = CORES_DO_FUNDO[f];
    return (
      <PaginaMini fundo={c.paper}
        topo={<span className="flex items-center justify-between px-2 py-1.5">{linha(c.ink, '30%')}{linha(c.ink, '35%', { opacity: 0.5 })}</span>}
        capa={(
          <span className="mx-2 mt-1 grid grid-cols-3 gap-1">
            {[0, 1, 2].map(i => <span key={i} className="block h-6 rounded" style={{ background: c.card }} />)}
          </span>
        )} />
    );
  };
  return (
    <Secao titulo="Fundo do site" descricao="A cor do fundo de todas as páginas e das caixas. No escuro, os textos ficam claros.">
      <Miniaturas rotulo="Fundo do site" valor={ap.background} mudar={background => mudar({ background })} opcoes={[
        { valor: 'light', nome: 'Claro', frase: 'O de sempre.', desenho: desenho('light') },
        { valor: 'dark', nome: 'Escuro', desenho: desenho('dark') },
      ]} />
      {ap.background === 'dark' && temLogo && !ap.logo_light_url && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Com fundo escuro, envie a logo clara: a logo normal pode sumir no topo e no rodapé.
        </p>
      )}
    </Secao>
  );
}

/* ── Topo ──────────────────────────────────────────────────────────────── */

export function BlocoTopo({ ap, mudar, corPrincipal }: PropsDoBloco & { corPrincipal: string }) {
  const barra = (bg: string, texto: string) => (
    <span className="flex items-center justify-between px-2 py-1.5" style={{ background: bg }}>
      {linha(texto, '30%')}{linha(texto, '35%', { opacity: 0.6 })}
    </span>
  );
  const capa = <span className="block h-full flex-1" style={{ background: FOTO }} />;
  const desenho = (estilo: EstiloDoTopo) => (
    <span className="relative flex h-full w-full flex-col" style={{ background: CORES_DO_FUNDO.light.paper }}>
      {estilo === 'transparent'
        ? <span className="absolute inset-x-0 top-0">{barra('transparent', '#FFFFFF')}</span>
        : barra(estilo === 'brand' ? corPrincipal : '#FFFFFF', estilo === 'brand' ? textoSobre(corPrincipal) : '#17140F')}
      {capa}
    </span>
  );

  const enviarLogoClara = async (file: File) => {
    const { url } = await siteBuilderService.uploadAsset(file);
    mudar({ logo_light_url: url });
  };

  return (
    <Secao
      titulo="Topo do site"
      descricao="A barra com a logo e o menu, em cima de todas as páginas. Ela acompanha a rolagem."
    >
      <Miniaturas rotulo="Estilo do topo" valor={ap.header_style} mudar={header_style => mudar({ header_style })} opcoes={[
        { valor: 'transparent', nome: 'Sobre a foto', frase: 'Na página inicial fica por cima do banner; ao rolar e nas outras páginas, na cor do fundo. O de sempre.', desenho: desenho('transparent') },
        { valor: 'brand', nome: 'Na cor principal', frase: 'Sempre na cor principal, também sobre o banner.', desenho: desenho('brand') },
        { valor: 'white', nome: 'Branco', frase: 'Sempre branco, mesmo com o fundo escuro.', desenho: desenho('white') },
      ]} />

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Logo clara</h3>
          <p className="text-sm text-muted-foreground">
            A versão branca ou clara do logo, pra fundo escuro. Vai sobre a foto do banner, no topo na cor principal quando o texto dele é branco e, com o fundo escuro, no topo e no rodapé. Sem ela, o site usa o logo normal (sobre a foto, ele fica branco).
          </p>
        </div>
        <EnvioDeImagem
          rotulo="Logo clara"
          fundo="escuro"
          url={ap.logo_light_url}
          enviar={enviarLogoClara}
          aoRemover={() => mudar({ logo_light_url: null })}
          confirmacao={{
            titulo: 'Remover a logo clara',
            descricao: 'O site volta a usar o logo normal em todos os lugares. Vale depois de salvar.',
          }}
        />
      </div>
    </Secao>
  );
}

/* ── Faixa de cima ─────────────────────────────────────────────────────── */

export function BlocoFaixaDeCima({ ap, mudar }: PropsDoBloco) {
  const faixa = (conteudo: ReactNode) => (
    <span className="flex h-full w-full flex-col" style={{ background: CORES_DO_FUNDO.light.paper }}>
      <span className="flex items-center justify-between gap-2 px-2 py-1" style={{ background: '#17140F' }}>{conteudo}</span>
      <span className="flex items-center justify-between px-2 py-1.5">{linha('#17140F', '30%')}{linha('#17140F', '35%', { opacity: 0.5 })}</span>
    </span>
  );
  const branco = 'rgba(255,255,255,0.75)';
  const pontos = (n: number) => (
    <span className="flex gap-1">{Array.from({ length: n }, (_, i) => <span key={i} className="block h-1.5 w-1.5 rounded-full" style={{ background: branco }} />)}</span>
  );
  const textos = (n: number) => <span className="flex flex-1 gap-1.5">{Array.from({ length: n }, (_, i) => <span key={i} className="block h-1 flex-1 rounded-full" style={{ background: branco }} />)}</span>;
  const desenhos: Record<FaixaDeCima, ReactNode> = {
    two_phones: faixa(<>{textos(2)}{textos(2)}</>),
    one_phone: faixa(<>{textos(1)}<span className="flex-1" />{textos(2)}</>),
    icons: faixa(<>{pontos(2)}{pontos(3)}</>),
    hidden: (
      <span className="flex h-full w-full flex-col" style={{ background: CORES_DO_FUNDO.light.paper }}>
        <span className="flex items-center justify-between px-2 py-1.5">{linha('#17140F', '30%')}{linha('#17140F', '35%', { opacity: 0.5 })}</span>
      </span>
    ),
  };
  return (
    <Secao
      titulo="Faixa de cima"
      descricao="A faixa fina acima do topo, com os contatos e as redes do site. Aparece só no computador e nas páginas que não são a inicial."
    >
      <Miniaturas rotulo="Faixa de cima" valor={ap.top_bar} mudar={top_bar => mudar({ top_bar })} opcoes={[
        { valor: 'two_phones', nome: 'Telefone, e-mail e redes', frase: 'O nome de cada rede, em texto. O de sempre.', desenho: desenhos.two_phones },
        { valor: 'one_phone', nome: 'Telefone e redes (sem e-mail)', frase: 'Sem telefone cadastrado, mostra o e-mail.', desenho: desenhos.one_phone },
        { valor: 'icons', nome: 'Só ícones', frase: 'Telefone, e-mail e redes só pelo ícone.', desenho: desenhos.icons },
        { valor: 'hidden', nome: 'Esconder', frase: 'Sem a faixa.', desenho: desenhos.hidden },
      ]} />
    </Secao>
  );
}

/* ── Altura e filtro do banner ─────────────────────────────────────────── */

export function BlocoCapa({ ap, mudar, foto }: PropsDoBloco & { foto: string | null }) {
  const desenho = (altura: AlturaDaCapa) => (
    <span className="flex h-full w-full flex-col" style={{ background: CORES_DO_FUNDO.light.paper }}>
      <span className="block" style={{ background: FOTO, height: altura === 'full' ? '100%' : '55%' }} />
      {altura === 'half' && (
        <span className="mx-2 mt-1 grid grid-cols-3 gap-1">
          {[0, 1, 2].map(i => <span key={i} className="block h-4 rounded bg-white" />)}
        </span>
      )}
    </span>
  );
  const fundoDaPrevia = CORES_DO_FUNDO[ap.background].paper;
  return (
    <Secao
      titulo="Altura e filtro do banner"
      descricao="O tamanho do banner da página inicial e o quanto a foto escurece pro título ficar legível."
    >
      <Miniaturas rotulo="Altura do banner" valor={ap.hero_height} mudar={hero_height => mudar({ hero_height })} opcoes={[
        { valor: 'half', nome: 'Meia tela', frase: 'Os imóveis já aparecem logo abaixo. O de sempre.', desenho: desenho('half') },
        { valor: 'full', nome: 'Tela cheia', frase: 'O banner ocupa a tela inteira ao abrir o site.', desenho: desenho('full') },
      ]} />

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="aparencia-filtro" className="text-sm font-medium">Filtro escuro sobre a foto</label>
          <span className="text-sm font-semibold tabular-nums" aria-hidden>{ap.hero_overlay}%</span>
        </div>
        <input id="aparencia-filtro" type="range" min={0} max={FILTRO_MAXIMO} step={1} value={ap.hero_overlay}
          aria-valuetext={`${ap.hero_overlay}%`} aria-describedby="aparencia-filtro-ajuda"
          onChange={e => mudar({ hero_overlay: Number(e.target.value) })} className="w-full accent-primary" />
        <p id="aparencia-filtro-ajuda" className="text-sm text-muted-foreground">
          De 0% (a foto como ela é) a {FILTRO_MAXIMO}% (bem escura). O de sempre é {FILTRO_FABRICA}%.
        </p>
        <div data-testid="previa-do-filtro" className="relative h-28 max-w-md overflow-hidden rounded-lg border border-border"
          style={{ ['--paper' as string]: fundoDaPrevia, background: foto ? `center / cover no-repeat url("${foto}")` : FOTO }}>
          <span className="absolute inset-0" style={{ background: filtroDaCapa(ap.hero_overlay) }} />
          <span className="absolute inset-x-0 top-6 text-center text-lg font-semibold text-white">Encontre seu imóvel</span>
        </div>
      </div>
    </Secao>
  );
}

/* ── Rodapé ────────────────────────────────────────────────────────────── */

export function BlocoRodape({ ap, mudar }: PropsDoBloco) {
  const desenho = (layout: LayoutDoRodape) => (
    <span className="flex h-full w-full flex-col justify-end" style={{ background: CORES_DO_FUNDO.light.paper }}>
      <span className="block border-t border-black/10 bg-white px-2 py-1.5">
        {layout === 'columns'
          ? (
            <span className="grid grid-cols-4 gap-1.5">
              {[0, 1, 2, 3].map(i => (
                <span key={i} className="flex flex-col gap-1">{linha('#17140F', '90%')}{linha('#9b968e', '70%')}{linha('#9b968e', '60%')}</span>
              ))}
            </span>
          )
          : <span className="flex items-center gap-1.5">{linha('#17140F', '20%')}{linha('#9b968e', '45%')}{linha('#25D366', '18%')}</span>}
      </span>
    </span>
  );
  const texto = ap.footer_text ?? '';
  return (
    <Secao
      titulo="Rodapé"
      descricao={(
        <>
          <p>A parte de baixo de todas as páginas.</p>
          <p className="mt-2">No fim do rodapé fica sempre, discreto, o “feito com LM Flow”, com link pro site do LM Flow.</p>
        </>
      )}
    >
      <Miniaturas rotulo="Jeito do rodapé" valor={ap.footer_layout} mudar={footer_layout => mudar({ footer_layout })} opcoes={[
        { valor: 'columns', nome: 'Em colunas', frase: 'Logo e frase, os links, e o contato: WhatsApp, telefone, e-mail, endereço e redes. O de sempre.', desenho: desenho('columns') },
        { valor: 'compact', nome: 'Compacto', frase: 'Uma faixa com o logo, os links e o WhatsApp, e embaixo a frase. Não mostra telefone, e-mail, endereço nem redes.', desenho: desenho('compact') },
      ]} />

      <CampoTextoLongo
        id="aparencia-rodape-texto"
        rotulo="Frase do rodapé"
        rows={3}
        placeholder={TEXTO_RODAPE_FABRICA}
        classeDoControle="resize-none"
        ajuda={`${contarCaracteres(texto)} de ${TETO_TEXTO_RODAPE} caracteres. Em branco, o site mostra a frase de sempre: “${TEXTO_RODAPE_FABRICA}”`}
        valor={texto}
        /* Sem `maxLength`: ele conta unidade UTF-16 e travaria antes dos 200 com emoji. */
        aoMudar={v => mudar({ footer_text: v === '' ? null : cortarCaracteres(v, TETO_TEXTO_RODAPE) })}
      />
    </Secao>
  );
}
