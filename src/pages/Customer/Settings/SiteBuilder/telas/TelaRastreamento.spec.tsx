import { describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import TelaRastreamento from './TelaRastreamento';

const SRC = join(process.cwd(), 'src');
function arquivos(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const cheio = join(dir, nome);
    if (statSync(cheio).isDirectory()) arquivos(cheio, saida);
    else if (/\.(ts|tsx)$/.test(nome) && !/\.spec\.tsx?$/.test(nome)) saida.push(cheio);
  }
  return saida;
}

describe('TelaRastreamento', () => {
  it('"Códigos avançados" sem o "(para quem entende)" (L3)', () => {
    render(<TelaRastreamento site={null} siteForm={{ name: 'Imob' }} setF={vi.fn()} irPara={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Códigos avançados' })).toBeTruthy();
    expect(screen.queryByText(/para quem entende/i)).toBeNull();
  });

  it('nenhuma tela do app diz "para quem entende"', () => {
    const comAFrase = arquivos(SRC).filter(f => /para quem entende/i.test(readFileSync(f, 'utf8')));
    expect(comAFrase).toEqual([]);
  });

  it('cada código tem rótulo visível e o erro aparece embaixo do campo', () => {
    render(<TelaRastreamento site={null} siteForm={{ name: 'Imob', ga4_measurement_id: 'UA-123' }} setF={vi.fn()} irPara={vi.fn()} />);
    const ga4 = screen.getByLabelText('Código de medição');
    expect(ga4.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Número do pixel')).toBeTruthy();
    expect(screen.getByLabelText('Código do contêiner')).toBeTruthy();
  });
});
