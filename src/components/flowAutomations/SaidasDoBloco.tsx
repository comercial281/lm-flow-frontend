// As saídas de um bloco que ramifica, desenhadas como no canvas: uma bolinha na
// cor da saída, o nome e quando ela acontece. Cores vêm de `handleColor`
// (flowAutomationGraph), quem chama passa a cor pronta.

export interface SaidaDoBloco {
  rotulo: string;
  cor: string;
  quando: string;
}

export function SaidasDoBloco({ saidas }: { saidas: SaidaDoBloco[] }) {
  return (
    <ul className="space-y-1.5" aria-label="Saídas do bloco">
      {saidas.map(s => (
        <li key={s.rotulo} className="flex items-start gap-2 text-sm">
          <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.cor }} />
          <span>
            <span className="font-medium">{s.rotulo}</span>
            <span className="block text-xs text-muted-foreground">{s.quando}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default SaidasDoBloco;
