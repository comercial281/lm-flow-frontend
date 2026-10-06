import type { HomeConfig } from '@/features/siteBuilder/public/homeConfig';

/* ────────────────────────────────────────────────────────────────────────────
   "Atendimento": quem atende o cliente. Opcional (home.about.enabled, desligado
   de fábrica). Com foto: foto à esquerda e texto à direita (empilhados no
   celular). Sem foto: só o texto, centralizado. Sem título e sem texto não há o
   que mostrar, e a seção some (selo e botão sozinhos não fazem seção).
   O botão `#contato` rola até o formulário de contato da própria página.
──────────────────────────────────────────────────────────────────────────── */

export default function HomeAtendimento({ home }: { home: HomeConfig }) {
  const a = home.about;
  const titulo = a.title?.trim() || null;
  const texto = a.text?.trim() || null;
  if (!a.enabled || (!titulo && !texto)) return null;

  const comFoto = !!a.photo_url;
  const interno = a.button_link === '#contato';
  const botao = a.button_label?.trim() && a.button_link ? (
    <a href={a.button_link} {...(interno ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
      className="mt-6 inline-flex rounded-xl px-6 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
      style={{ background: 'var(--brand)' }}>
      {a.button_label.trim()}
    </a>
  ) : null;

  const conteudo = (
    <div className={comFoto ? 'text-left' : 'mx-auto max-w-2xl'}>
      {a.eyebrow?.trim() && <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">{a.eyebrow.trim()}</p>}
      {titulo && <h2 className="mt-2 font-[var(--display)] text-3xl font-semibold leading-tight text-[var(--ink)] sm:text-4xl">{titulo}</h2>}
      {texto && <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-neutral-600">{texto}</p>}
      {botao}
    </div>
  );

  return (
    <section id="atendimento" className={`mx-auto max-w-6xl px-4 py-14 sm:px-6 ${comFoto ? '' : 'text-center'}`}>
      {comFoto ? (
        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
          <img src={a.photo_url!} alt="Foto de quem atende" className="aspect-[4/3] w-full rounded-[24px] object-cover" loading="lazy" />
          {conteudo}
        </div>
      ) : conteudo}
    </section>
  );
}
