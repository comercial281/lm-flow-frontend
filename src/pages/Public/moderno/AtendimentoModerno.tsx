import type { HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import type { DestaqueDosTitulos } from '@/features/siteBuilder/public/aparenciaConfig';
import { TituloComDestaque } from '../TituloComDestaque';
import { BLOCO, BOTAO_PRINCIPAL, MIOLO, SOBRETITULO, tituloDeSecao } from './estilos';

/* ────────────────────────────────────────────────────────────────────────────
   "Atendimento" do Moderno (protótipo `.about`): os mesmos campos e regras do
   Clássico (`home.about`). Título e texto à direita; à esquerda a foto, se
   houver, ou o selo. Sem foto e sem selo, uma coluna só (a da esquerda
   ficaria vazia). Sem título e sem texto, a seção some. O botão
   `#contato` rola até o contato da própria página (mesma aba).
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

  const duasColunas = !!a.photo_url || !!selo;
  return (
    <section id="atendimento" className={BLOCO}>
      <div className={`${MIOLO} grid items-start gap-10 ${duasColunas ? 'md:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]' : ''}`}>
        {a.photo_url
          ? <img src={a.photo_url} alt="Foto de quem atende" loading="lazy" className="aspect-[4/5] w-full rounded-[28px] object-cover" />
          : selo && <div><p className={SOBRETITULO}>{selo}</p></div>}
        <div className="min-w-0">
          {a.photo_url && selo && <p className={SOBRETITULO}>{selo}</p>}
          {titulo && (
            <h2 className={tituloDeSecao('text-[clamp(28px,3.6vw,44px)]')}>
              <TituloComDestaque texto={titulo} modo={modo} />
            </h2>
          )}
          {texto && <p className="mt-[18px] max-w-[52ch] whitespace-pre-line text-[15px] leading-relaxed text-[var(--m-text)]">{texto}</p>}
          {botao}
        </div>
      </div>
    </section>
  );
}
