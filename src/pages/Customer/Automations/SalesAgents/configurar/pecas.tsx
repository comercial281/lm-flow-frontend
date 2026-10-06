// Peças do passo a passo da IA. Opção de ligar/desligar DENTRO de um passo é
// caixinha (espera o Salvar); chave só no Ligar do passo 8 (regra da Fase 3:
// chave = efeito na hora).
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import BarraSalvar from '@/components/base/BarraSalvar';
import { Secoes } from '@/components/base/Secao';
import { PASSOS, type NumeroDoPasso } from './passos';

export function Caixa({ id, rotulo, descricao, marcada, aoMudar, desabilitada }: {
  id: string;
  rotulo: string;
  descricao?: ReactNode;
  marcada: boolean;
  aoMudar: (v: boolean) => void;
  desabilitada?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={marcada} disabled={desabilitada}
        aria-describedby={descricao ? `${id}-desc` : undefined} onChange={(e) => aoMudar(e.target.checked)} />
      <div>
        <label htmlFor={id} className="text-sm font-medium">{rotulo}</label>
        {descricao && <p id={`${id}-desc`} className="text-sm text-muted-foreground">{descricao}</p>}
      </div>
    </div>
  );
}

export interface OpcaoDeEscolha<T extends string> {
  valor: T;
  titulo: string;
  descricao?: string;
  desabilitada?: boolean;
  motivo?: string;
}

export function Escolha<T extends string>({ nome, legenda, valor, opcoes, aoEscolher }: {
  nome: string;
  legenda: string;
  valor: T | null;
  opcoes: OpcaoDeEscolha<T>[];
  aoEscolher: (v: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{legenda}</legend>
      {opcoes.map((o) => {
        const id = `${nome}-${o.valor}`;
        const escolhida = valor === o.valor;
        const frase = o.desabilitada && o.motivo ? o.motivo : o.descricao;
        return (
          <div key={o.valor} className={cn('flex items-start gap-3 rounded-lg border p-3', escolhida ? 'border-primary bg-primary/5' : 'border-border', o.desabilitada && 'opacity-60')}>
            <input id={id} type="radio" name={nome} className="mt-1" checked={escolhida} disabled={o.desabilitada}
              aria-describedby={frase ? `${id}-desc` : undefined} onChange={() => aoEscolher(o.valor)} />
            <div>
              <label htmlFor={id} className="text-sm font-medium">{o.titulo}</label>
              {frase && <p id={`${id}-desc`} className="text-sm text-muted-foreground">{frase}</p>}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

export function Aviso({ tom = 'ambar', children }: { tom?: 'ambar' | 'vermelho' | 'neutro'; children: ReactNode }) {
  const cor = tom === 'vermelho'
    ? 'border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-400'
    : tom === 'ambar' ? 'border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-400' : 'border-border bg-muted/40 text-muted-foreground';
  return <div className={cn('rounded-md border p-3 text-sm', cor)}>{children}</div>;
}

export function CascaDoPasso({ numero, previa, pendente, salvando, erro, aoSalvar, aoDescartar, children }: {
  numero: NumeroDoPasso;
  previa?: ReactNode;
  pendente: boolean;
  salvando: boolean;
  erro: string | null;
  aoSalvar: () => void;
  aoDescartar: () => void;
  children: ReactNode;
}) {
  const passo = PASSOS.find((p) => p.numero === numero)!;
  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-muted-foreground">Passo {numero} de 8</p>
        <h1 className="text-xl font-semibold">{passo.titulo}</h1>
        <p className="text-sm text-muted-foreground">{passo.frase}</p>
      </header>
      {/* ⚠️ Pela largura DESTA área (contêiner), não da janela: entre o menu lateral e o
          trilho dos passos sobra bem menos que a janela, e com a prévia ao lado os
          campos ficavam espremidos e vazavam por cima dela. Ao lado só com folga. */}
      <div className="@container">
        <div className={previa ? 'grid gap-6 @5xl:grid-cols-[minmax(0,1fr)_320px]' : undefined}>
          <Secoes className="min-w-0">{children}</Secoes>
          {previa && (
            <aside aria-label="Prévia" className="h-fit rounded-xl border border-border bg-muted/30 p-4 @5xl:sticky @5xl:top-4">
              {previa}
            </aside>
          )}
        </div>
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <BarraSalvar visivel={pendente} salvando={salvando} aoSalvar={aoSalvar} aoDescartar={aoDescartar} />
    </div>
  );
}
