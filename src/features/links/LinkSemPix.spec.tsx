import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import LinkSemPix from './LinkSemPix';

const UUID = '0b6f5c1a-3d2e-4f10-8a9b-c7d6e5f40312';
const CODIGO = '2Qu7ReJ5bTo99bHR2atWs3'; // começa com algarismo: o caso que abriria a conversa errada

// Toda tela que montar anota o id que viu. A de Conversas joga pra lista
// qualquer id que não seja UUID, então ela NÃO pode montar com o código.
function abrir(endereco: string) {
  const vistos: string[] = [];
  function Tela() {
    const { id } = useParams();
    const { pathname, search } = useLocation();
    vistos.push(id ?? '');
    return <p>{`${pathname}${search}`}</p>;
  }
  render(
    <MemoryRouter initialEntries={[endereco]}>
      <LinkSemPix>
        <Routes>
          <Route path="/conversations/:id" element={<Tela />} />
          <Route path="/roleta/aceite/:id" element={<Tela />} />
        </Routes>
      </LinkSemPix>
    </MemoryRouter>,
  );
  return vistos;
}

describe('LinkSemPix', () => {
  it('link com código: a tela só monta já com o UUID', async () => {
    const vistos = abrir(`/conversations/${CODIGO}`);
    expect(await screen.findByText(`/conversations/${UUID}`)).toBeInTheDocument();
    expect(vistos).not.toContain(CODIGO);
    expect(vistos).toContain(UUID);
  });

  it('link antigo, com UUID, abre direto', () => {
    const vistos = abrir(`/conversations/${UUID}`);
    expect(screen.getByText(`/conversations/${UUID}`)).toBeInTheDocument();
    expect(vistos).toEqual([UUID]);
  });

  it('aceite de teste passa intacto', () => {
    abrir('/roleta/aceite/teste?prazo=10&destino=roleta');
    expect(screen.getByText('/roleta/aceite/teste?prazo=10&destino=roleta')).toBeInTheDocument();
  });

  it('envolve as rotas do app (sem ele, link com código cai na lista de Conversas)', () => {
    const src = readFileSync(resolve(__dirname, '../../routes/index.tsx'), 'utf8');
    expect(src).toMatch(/<LinkSemPix>\s*<Routes>/);
  });
});
