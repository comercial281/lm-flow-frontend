// src/pages/SuperAdmin/PooledClients/QuadrosDeFuncoes.tsx
import { useMemo, useState } from 'react';
import Chave from '@/components/base/Chave';
import { Button, Input } from '@/components/ui/ds';
import { groupCatalogByTheme, itemLabel, matchesQuery, type CatalogItem } from '../featureCatalog';

// Funções por tema, em quadros lado a lado, TODOS abertos (entrega 3). Mesmas
// regras de 03/09: tema decidido pelo servidor, nada some, tema inteiro = uma
// chamada. Usado na página do cliente e no editor de pacote.
export interface PropsQuadros {
  catalog: CatalogItem[];
  ligada: (key: string) => boolean;
  aoMudar: (patch: Record<string, boolean>, contexto: { menu?: string }) => Promise<boolean | void>;
  diferentes?: Set<string>;
  somenteDiferentes?: boolean;
}

export default function QuadrosDeFuncoes({ catalog, ligada, aoMudar, diferentes, somenteDiferentes }: PropsQuadros) {
  const [busca, setBusca] = useState('');
  const secoes = useMemo(() => groupCatalogByTheme(catalog).map((s) => ({
    ...s,
    menus: s.menus.map((m) => ({
      ...m,
      all: m.all.filter((i) => matchesQuery(i, busca) && (!somenteDiferentes || diferentes?.has(i.key))),
    })).filter((m) => m.all.length > 0),
  })).filter((s) => s.menus.length > 0), [catalog, busca, somenteDiferentes, diferentes]);

  return (
    <div className="flex flex-col gap-3">
      <Input type="search" aria-label="Buscar função" placeholder="Buscar função…" value={busca}
        onChange={(e) => setBusca(e.target.value)} className="w-full sm:w-72" />
      {secoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{somenteDiferentes ? 'Nada difere do pacote.' : 'Nenhuma função com esse nome.'}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {secoes.map((s) => {
            const chaves = s.menus.flatMap((m) => m.all.map((i) => i.key));
            const ligadas = chaves.filter((k) => ligada(k)).length;
            const idTitulo = `tema-${s.key}`;
            return (
              <section key={s.key} role="region" aria-labelledby={idTitulo} className="rounded-lg border bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 id={idTitulo} className="text-sm font-semibold">{s.label}</h3>
                  <span className="text-xs text-muted-foreground">{ligadas} de {chaves.length} ligadas</span>
                </div>
                <div className="mb-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void aoMudar(Object.fromEntries(chaves.map((k) => [k, true])), {})}>Ligar tudo</Button>
                  <Button size="sm" variant="outline" onClick={() => void aoMudar(Object.fromEntries(chaves.map((k) => [k, false])), {})}>Desligar tudo</Button>
                </div>
                {s.menus.map((m) => {
                  const menuLigado = m.toggle ? ligada(m.toggle.key) : true;
                  return (
                    <div key={m.key} className="border-t py-1.5 first:border-t-0">
                      {m.all.map((item) => {
                        const ehMenu = !!m.toggle && item.key === m.toggle.key;
                        const rotulo = itemLabel(item);
                        return (
                          <div key={item.key} className={`flex items-center justify-between gap-2 py-1 ${ehMenu ? '' : 'pl-3'}`}>
                            <span className="flex min-w-0 items-center gap-1.5 text-sm">
                              {diferentes?.has(item.key) && <span className="shrink-0 text-xs text-amber-700 dark:text-amber-300">≠ pacote</span>}
                              <span className={`truncate ${!ehMenu && !menuLigado ? 'text-muted-foreground' : ''}`}>{rotulo}</span>
                              {ehMenu && <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">menu inteiro</span>}
                            </span>
                            <Chave rotulo={rotulo} semRotuloVisivel ligada={ligada(item.key)} genero="a"
                              desabilitada={!ehMenu && !menuLigado}
                              aoMudar={(proximo) => aoMudar({ [item.key]: proximo }, ehMenu ? { menu: rotulo } : {})} />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
