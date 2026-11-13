import { I, Ic, Select, type PortalProperty, type SiteInfo } from '../portalShared';
import type { AbaId, HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import { filtroDaCapa, logoNaCapa, logoNaSuperficie, resolverAparencia } from '@/features/siteBuilder/public/aparenciaConfig';
import { ATRIBUTO_DO_LOGO_DA_CAPA, useLogoPousado } from '@/features/siteBuilder/public/logoPousado';
import { semAsteriscos } from '@/features/siteBuilder/public/destaqueNoTitulo';
import CampoDeLugar from '../CampoDeLugar';
import FundoDaCapa from './FundoDaCapa';
import { ROTULO_ABA, fotosDaCapa, lugarLargo, textosDaCapa, useBuscaDaCapa } from './useBuscaDaCapa';

/* ────────────────────────────────────────────────────────────────────────────
   Capa da página inicial: foto/vídeo, título, subtítulo e a busca rápida.
   Abas e campos vêm do Personalizar (home.search); a busca é só a ENTRADA —
   ela leva à página dedicada (`/portal/:tenant/imoveis`) com os filtros na URL.
   O estado e a ida da busca moram em `useBuscaDaCapa` (o mesmo da capa do Moderno).
──────────────────────────────────────────────────────────────────────────── */

interface Props {
  site: SiteInfo;
  home: HomeConfig;
  items: PortalProperty[];
  tenant: string;
  abas: AbaId[];
  cities: string[];
  hoods: string[];
  types: string[];
  /** Avisado quando a pessoa troca de aba (a captura de contato acompanha). */
  onTab?: (tab: AbaId) => void;
}

export default function HomeCapa({ site, home, items, tenant, abas, cities, hoods, types, onTab }: Props) {
  const { tab, trocarAba, valores, set, selects, primeira, mais, abertos, alternarMais, escolherLugar, temCodigo, runSearch, opcoes } =
    useBuscaDaCapa({ home, tenant, abas, cities, hoods, types, items, onTab, modelo: 'classico' });
  const { titulo, subtitulo } = textosDaCapa(site, home);

  // Aparência: "Tela cheia" ocupa a altura da tela e centra o conteúdo; "Meia
  // tela" (fábrica) é a de sempre, com a altura vinda só do respiro. O filtro
  // escuro sobe ou desce com `hero_overlay` (45 = o degradê de sempre).
  const ap = resolverAparencia(site.appearance);
  const telaCheia = ap.hero_height === 'full';

  // Logo em destaque (Aparência › Logo na página inicial): grande ao lado do
  // título no computador, em cima dele no celular. Vai sobre a foto, então
  // segue a regra do topo sobre a capa: a logo clara, ou a normal em branco.
  // Quando encosta no topo, some daqui e aparece lá (`useLogoPousado`).
  const destaque = logoNaCapa(ap, site.branding?.logo_url);
  const pousado = useLogoPousado(destaque);
  const logoDaCapa = destaque ? logoNaSuperficie(site.branding?.logo_url, ap, 'foto') : null;
  const logoCls = logoDaCapa
    ? `object-contain transition-opacity duration-300 motion-reduce:transition-none${logoDaCapa.clara ? '' : ' brightness-0 invert'}${pousado ? ' opacity-0' : ''}`
    : '';

  // Foto ou vídeo do banner e a busca: os mesmos nas duas capas.
  const midia = site.hero?.video_url ? (
    <video
      src={site.hero.video_url}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      className="h-full w-full object-cover"
    />
  ) : (
    // Foto escolhida no Site Builder (de um imóvel ou enviada); sem ela,
    // a capa do primeiro imóvel da lista, como sempre foi.
    <FundoDaCapa fotos={fotosDaCapa(site, items)} />
  );

  // O lugar é texto com sugestões; os outros campos são listas. Sobre a foto a capa corta o que sai da
  // borda (overflow-hidden; o markup dela é trava de teste), então a lista abre pra cima, sobre o título.
  // Com "Mais filtros" e o lugar entre os 3 primeiros, ele ocupa 2 colunas: a linha fecha as 4 sem buraco.
  const largo = lugarLargo(primeira, mais);
  const campo = (c: (typeof selects)[number]) => {
    if (c === 'place') {
      return <CampoDeLugar key={c} items={items} tab={tab} texto={valores.place ?? ''} onTexto={set('place')} onEscolher={escolherLugar}
        abrirPara={ap.hero_layout === 'split' ? 'baixo' : 'cima'} className={largo && primeira.includes(c) ? 'md:col-span-2' : ''} />;
    }
    const o = opcoes[c];
    return <Select key={c} value={valores[c] ?? ''} onChange={set(c)} label={o.label} options={o.options} />;
  };

  // Busca (entrada → página dedicada de filtros)
  const busca = (
    <form onSubmit={runSearch} className="mt-8 rounded-[24px] bg-white/95 p-3 shadow-[0_30px_60px_-25px_rgba(0,0,0,0.5)] backdrop-blur sm:p-4">
      {/* Uma aba só não é escolha: a fileira some. */}
      {abas.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {abas.map(k => (
            <button key={k} type="button" onClick={() => trocarAba(k)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${tab === k ? 'text-white' : 'text-neutral-600 hover:bg-black/[0.04]'}`}
              style={tab === k ? { background: 'var(--brand)' } : undefined}>
              {ROTULO_ABA[k]}
            </button>
          ))}
        </div>
      )}

      {primeira.length > 0 && <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{primeira.map(campo)}</div>}
      {abertos && mais.length > 0 && <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">{mais.map(campo)}</div>}

      <div className={`flex flex-col gap-2 sm:flex-row ${primeira.length > 0 ? 'mt-2' : ''}`}>
        {temCodigo && (
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"><Ic d={I.search} s={17} /></span>
            <input value={valores.code ?? ''} onChange={e => set('code')(e.target.value)} placeholder="Buscar por código do imóvel"
              className="w-full rounded-xl border border-black/[0.08] bg-white py-3 pl-10 pr-3 text-[14px] outline-none focus:border-[var(--brand)]" />
          </div>
        )}
        {mais.length > 0 && (
          <button type="button" onClick={alternarMais} aria-expanded={abertos}
            className={`inline-flex items-center justify-center rounded-xl border border-black/[0.08] px-5 py-3 text-[14px] font-semibold text-neutral-700 transition-colors hover:bg-black/[0.04] ${temCodigo ? '' : 'sm:ml-auto'}`}>
            {abertos ? 'Menos filtros' : 'Mais filtros'}
          </button>
        )}
        <button type="submit" className={`inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 ${temCodigo || mais.length > 0 ? '' : 'sm:ml-auto'}`} style={{ background: 'var(--brand)' }}>
          <Ic d={I.search} s={17} /> Buscar
        </button>
      </div>
    </form>
  );

  // Capa dividida (Aparência): texto e busca de um lado e a foto num quadro
  // arredondado do outro. No celular o texto e a busca vêm primeiro e a foto
  // depois, com 240px. Sem filtro escuro: o texto não fica sobre a foto. O
  // topo aqui é sólido (portalShared), então o respiro de cima continua.
  if (ap.hero_layout === 'split') {
    return (
      <section id="topo" className={telaCheia ? 'relative flex min-h-[100svh] flex-col justify-center' : 'relative'}>
        <div className={`relative mx-auto grid max-w-6xl gap-8 px-4 pb-10 pt-28 sm:px-6 sm:pt-32 md:grid-cols-2 md:items-center md:gap-10 md:pb-16 md:pt-36${telaCheia ? ' w-full' : ''}`}>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{site.name || 'Portal Imobiliário'}</p>
            <h1 className="mt-3 font-[var(--display)] text-4xl font-semibold leading-[1.05] text-[var(--ink)] sm:text-5xl">
              {semAsteriscos(titulo)}
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-neutral-600 sm:text-base">{subtitulo}</p>
            {busca}
          </div>
          <div className="relative h-[240px] overflow-hidden rounded-[28px] md:h-full md:min-h-[440px]" style={{ background: '#17140f' }}>
            <div className="absolute inset-0">{midia}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="topo" className={telaCheia ? 'relative flex min-h-[100svh] flex-col justify-center overflow-hidden' : 'relative overflow-hidden'}>
      <div className="absolute inset-0" style={{ background: '#17140f' }}>
        {midia}
        <div className="absolute inset-0" style={{ background: filtroDaCapa(ap.hero_overlay) }} />
      </div>

      {/* pt maior: o cabeçalho FLUTUA sobre a capa (ele sai do fluxo), então o
          título precisa do espaço dele de volta. */}
      <div className={`relative mx-auto max-w-6xl px-4 pb-8 pt-32 sm:px-6 sm:pt-40 md:pb-16 md:pt-44${telaCheia ? ' w-full' : ''}`}>
        {logoDaCapa?.url ? (
          <>
            {/* O nome em cima do título sai: o logo já diz quem é. */}
            <img {...{ [ATRIBUTO_DO_LOGO_DA_CAPA]: '' }} src={logoDaCapa.url} alt={site.name || 'Portal'}
              className={`mb-6 h-20 w-auto max-w-[75%] object-left sm:h-24 lg:hidden ${logoCls}`} />
            {/* Computador: o logo do lado direito, com a altura das duas linhas
                do título (60px × 1,05 × 2 = 126px), centrado nele e encostado
                na borda direita, a mesma da busca. Logo comprido para no max-w. */}
            <div className="lg:flex lg:items-center lg:justify-between lg:gap-10">
              <h1 className="max-w-2xl font-[var(--display)] text-4xl font-semibold leading-[1.05] text-white sm:text-5xl md:text-6xl">
                {semAsteriscos(titulo)}
              </h1>
              <img {...{ [ATRIBUTO_DO_LOGO_DA_CAPA]: '' }} src={logoDaCapa.url} alt={site.name || 'Portal'}
                className={`hidden h-[126px] w-auto max-w-[420px] shrink-0 object-right lg:block ${logoCls}`} />
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-white/80">{site.name || 'Portal Imobiliário'}</p>
            <h1 className="mt-3 max-w-2xl font-[var(--display)] text-4xl font-semibold leading-[1.05] text-white sm:text-5xl md:text-6xl">
              {semAsteriscos(titulo)}
            </h1>
          </>
        )}
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/85 sm:text-base">{subtitulo}</p>

        {busca}
      </div>
    </section>
  );
}
