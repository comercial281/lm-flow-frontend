import type { HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import type { DestaqueDosTitulos } from '@/features/siteBuilder/public/aparenciaConfig';
import { TituloComDestaque } from '../TituloComDestaque';
import { BLOCO, BOTAO_PRINCIPAL, MIOLO, SOBRETITULO, tituloDeSecao } from './estilos';

/* ────────────────────────────────────────────────────────────────────────────
   "Atendimento" do Moderno (protótipo `.about`): os mesmos campos e regras do
   Clássico (`home.about`). Sem título e sem texto, a seção some. O botão
   `#contato` rola até o contato da própria página (mesma aba).
   - Com foto: a foto num cartão à esquerda; selo, título, texto e botão à
     direita, centrados na altura da foto.
   - Sem foto: duas colunas equilibradas. À esquerda o selo em cima do título
     grande; à direita o texto e o botão, alinhados ao pé do título. Se um
     dos lados ficaria vazio (só título, ou só texto), uma coluna só.
   - Celular: uma coluna (selo, título, texto, botão).
──────────────────────────────────────────────────────────────────────────── */

export default function AtendimentoModerno({ home, modo }: { home: HomeConfig; modo: DestaqueDosTitulos }) {
  const a = home.about;
  const titulo = a.title?.trim() || null;
  const texto = a.text?.trim() || null;
  if (!a.enabled || (!titulo && !texto)) return null;

  const selo = a.eyebrow?.trim() || null;
  const interno = a.button_link === '#contato';
  const botao = a.button_label?.trim() && a.button_link ? (
    <a href={a.button_link} {...(interno ? {} : { target: '_blank', rel: 'noopener noreferrer' })} className={`mt-7 ${BOTAO_PRINCIPAL}`}>
      {a.button_label.trim()}
    </a>
  ) : null;

  const seloEl = selo && <p className={SOBRETITULO}>{selo}</p>;
  const textoEl = texto && <p className="mt-[18px] max-w-[52ch] whitespace-pre-line text-[15px] leading-relaxed text-[var(--m-text)]">{texto}</p>;

  if (a.photo_url) {
    return (
      <section id="atendimento" className={BLOCO}>
        <div className={`${MIOLO} grid gap-10 md:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] md:items-center`}>
          <img src={a.photo_url} alt="Foto de quem atende" loading="lazy" className="aspect-[4/5] w-full rounded-[28px] object-cover" />
          <div className="min-w-0">
            {seloEl}
            {titulo && (
              <h2 className={tituloDeSecao('text-[clamp(28px,3.6vw,44px)]')}>
                <TituloComDestaque texto={titulo} modo={modo} />
              </h2>
            )}
            {textoEl}
            {botao}
          </div>
        </div>
      </section>
    );
  }

  // Sem foto: selo + título de um lado, texto + botão do outro, no pé do título.
  const esquerda = (seloEl || titulo) && (
    <div className="min-w-0">
      {seloEl}
      {titulo && (
        <h2 className={tituloDeSecao()}>
          <TituloComDestaque texto={titulo} modo={modo} />
        </h2>
      )}
    </div>
  );
  const direita = (texto || botao) && (
    <div className="min-w-0 md:[&>p:first-child]:mt-0 md:[&>a:first-child]:mt-0">
      {textoEl}
      {botao}
    </div>
  );
  const duasColunas = !!titulo && !!direita;
  return (
    <section id="atendimento" className={BLOCO}>
      <div className={`${MIOLO} grid gap-x-16 ${duasColunas ? 'md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-end' : ''}`}>
        {esquerda}
        {direita}
      </div>
    </section>
  );
}
