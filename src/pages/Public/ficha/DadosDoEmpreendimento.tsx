/** Dados do prédio (torres, andares, unidades, padrão) e a construtora. */
export default function DadosDoEmpreendimento({ dados, construtora }: {
  dados: { rotulo: string; valor: string }[];
  construtora: { nome: string; site: string | null } | null;
}) {
  if (dados.length === 0 && !construtora) return null;
  return (
    <section className="mt-9">
      <h2 className="font-[var(--display)] text-2xl font-semibold">Dados do empreendimento</h2>
      {dados.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {dados.map(d => (
            <div key={d.rotulo} className="rounded-2xl bg-white p-4 ring-1 ring-black/[0.06]">
              <dt className="text-[13px] text-neutral-500">{d.rotulo}</dt>
              <dd className="mt-1 text-[15px] font-semibold text-[var(--ink)]">{d.valor}</dd>
            </div>
          ))}
        </dl>
      )}
      {construtora && (
        <p className="mt-3 text-[15px] text-neutral-700">
          Construtora:{' '}
          {construtora.site
            ? <a href={construtora.site} target="_blank" rel="noopener" className="font-semibold text-[var(--brand)] underline-offset-2 hover:underline">{construtora.nome}</a>
            : <span className="font-semibold text-[var(--ink)]">{construtora.nome}</span>}
        </p>
      )}
    </section>
  );
}
