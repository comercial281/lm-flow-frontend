import { describe, expect, it } from 'vitest';
import { arquivosSemQuando, casosDe, paginaDoEnsinarDaUrl, regrasForaDoLimite, textoDosCasos } from './paginas';
import type { SalesAgentDocument, SalesAgentLesson } from '@/services/salesAgents/salesAgentsService';

const licao = (p: Partial<SalesAgentLesson>) => ({ id: 'x', kind: 'rule', content: 'c', context: null, enabled: true, created_at: '', origin: 'manual', in_use: true, ...p }) as SalesAgentLesson;

describe('registro do Ensinar', () => {
  it('lê a página do endereço; desconhecida ou da cadeia do objeto vira null', () => {
    expect(paginaDoEnsinarDaUrl(new URLSearchParams('pagina=regras'))).toBe('regras');
    expect(paginaDoEnsinarDaUrl(new URLSearchParams('pagina=destino'))).toBeNull();
    expect(paginaDoEnsinarDaUrl(new URLSearchParams('pagina=constructor'))).toBeNull();
    expect(paginaDoEnsinarDaUrl(new URLSearchParams(''))).toBeNull();
  });

  it('regra fora do limite = ligada e não valendo (pausada não conta)', () => {
    expect(regrasForaDoLimite([licao({ in_use: false }), licao({ in_use: false, enabled: false }), licao({ kind: 'good_example', in_use: false })])).toBe(1);
  });

  it('arquivo que manda sem "quando" é pendência', () => {
    const d = (p: Partial<SalesAgentDocument>) => ({ sendable: true, send_when: 'x', ...p }) as SalesAgentDocument;
    expect(arquivosSemQuando([d({ send_when: '  ' }), d({ send_when: null }), d({ sendable: false, send_when: null }), d({})])).toBe(2);
  });

  it('prova social: divide por linha sem caso vazio e junta de volta', () => {
    expect(casosDe('  A \n\n B\n')).toEqual(['A', 'B']);
    expect(casosDe(null)).toEqual([]);
    expect(textoDosCasos(['A', 'B'])).toBe('A\nB');
    expect(textoDosCasos([])).toBeNull();
    expect(textoDosCasos(casosDe('A\nB'))).toBe('A\nB');
  });
});
