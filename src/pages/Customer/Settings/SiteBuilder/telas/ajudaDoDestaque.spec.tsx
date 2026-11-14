import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AJUDA_DO_DESTAQUE } from '@/features/siteBuilder/public/destaqueNoTitulo';

/* Os campos de título onde o asterisco vale (spec 6.1: capa, vitrines, Como
   funciona, chamadas, Atendimento e a frase do rodapé) explicam o asterisco.
   Conferido no código das telas: cada uma usa a mesma frase. */

const tela = (nome: string) => readFileSync(join(process.cwd(), 'src/pages/Customer/Settings/SiteBuilder/telas', nome), 'utf8');

describe('ajuda do asterisco nos títulos', () => {
  it('a frase', () => {
    expect(AJUDA_DO_DESTAQUE).toBe('Coloque uma palavra entre asteriscos pra destacar (vale no modelo Moderno).');
  });

  it.each([
    ['TelaBusca.tsx', 1], ['TelaVitrines.tsx', 1], ['TelaSecoes.tsx', 2], ['TelaChamadas.tsx', 1], ['BlocosDoVisual.tsx', 1],
  ])('%s usa a ajuda em %i campo(s)', (arquivo, n) => {
    expect(tela(arquivo).match(/AJUDA_DO_DESTAQUE/g)?.length ?? 0).toBeGreaterThanOrEqual(n + 1); // + o import
  });
});
