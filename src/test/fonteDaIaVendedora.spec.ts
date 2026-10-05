import { describe, expect, it } from 'vitest';

import { fonteDaIaVendedora, lerTelaDaIa } from './fonteDaIaVendedora';

// O helper é a rede dos specs de cicatriz calada: se ele parar de ler uma
// subpasta, aqueles specs passam sem olhar o código que deveriam conferir.
describe('fonteDaIaVendedora', () => {
  const fonte = fonteDaIaVendedora();

  it('lê a casca, as telas e a configuração antiga', () => {
    expect(fonte).toContain('export default function SalesAgents');
    expect(fonte).toContain('export function HandoffPolicySection');
    expect(fonte).toContain('export default function TelaDiagnostico');
    expect(fonte).toContain('export function KnowledgeTab');
  });

  it('a casca vem primeiro (os cortes do saveAgent dependem disso)', () => {
    expect(fonte.startsWith(lerTelaDaIa('SalesAgents.tsx'))).toBe(true);
  });

  it('deixa de fora o assistente e os specs', () => {
    expect(fonte).not.toContain('export default function AssistenteIA');
    expect(fonte).not.toContain("from 'vitest'");
  });
});
