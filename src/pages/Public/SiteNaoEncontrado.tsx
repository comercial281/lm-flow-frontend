import { useEffect } from 'react';

/**
 * Domínio que aponta para o LM Flow mas não tem site ativo: domínio cadastrado
 * e ainda não verificado, removido, ou que nunca foi cadastrado. Nunca mostra a
 * tela de entrada do CRM. Página simples, sem nada do sistema.
 *
 * `erro`: não deu para perguntar ao servidor (rede, servidor fora). Aí o texto
 * não afirma que o site não existe, e oferece tentar de novo.
 */
export default function SiteNaoEncontrado({ erro = false }: { erro?: boolean }) {
  useEffect(() => {
    document.title = erro ? 'Site indisponível' : 'Site não encontrado';
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex';
  }, [erro]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAF7F2] px-6 text-center" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 className="text-2xl font-semibold text-[#17140F]">
        {erro ? 'Não deu para abrir o site agora' : 'Site não encontrado'}
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-neutral-600">
        {erro
          ? 'Tente de novo em alguns instantes.'
          : 'Este endereço ainda não abre nenhum site. Se ele é seu, confira em Meu site › Endereço do site, no LM Flow.'}
      </p>
      {erro && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-full bg-[#17140F] px-5 py-2.5 text-[14px] font-semibold text-white"
        >
          Tentar de novo
        </button>
      )}
    </main>
  );
}
