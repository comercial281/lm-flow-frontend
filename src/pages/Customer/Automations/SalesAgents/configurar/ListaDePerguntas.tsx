// A lista de perguntas do Roteiro: cada uma com "obrigatória", na ordem em que ela
// pergunta. Obrigatória = ela só passa o lead com a resposta (cenário do checklist).
//
// ⚠️ Não deixa ficar sem nenhuma marcada: lista de obrigatórias vazia no servidor
// quer dizer TODAS, e a caixinha voltaria marcada sozinha.
import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '@/components/ui/ds';
import { CLASSE_DO_CAMPO } from '@/components/base/Campo';
import type { Pergunta } from '@/features/salesAgents/perguntas';

const ULTIMA = 'Pelo menos uma pergunta precisa ser obrigatória. Sem nenhuma marcada, todas valem.';

export function ListaDePerguntas({ perguntas, aoMudar }: { perguntas: Pergunta[]; aoMudar: (lista: Pergunta[]) => void }) {
  const [aviso, setAviso] = useState<string | null>(null);
  const marcadas = perguntas.filter((p) => p.obrigatoria).length;
  const ehUltimaMarcada = (i: number) => perguntas[i].obrigatoria && marcadas === 1 && perguntas.length > 1;

  const trocar = (i: number, p: Partial<Pergunta>) => aoMudar(perguntas.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const marcar = (i: number, v: boolean) => {
    if (!v && ehUltimaMarcada(i)) { setAviso(ULTIMA); return; }
    setAviso(null);
    trocar(i, { obrigatoria: v });
  };
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= perguntas.length) return;
    const n = [...perguntas];
    [n[i], n[j]] = [n[j], n[i]];
    aoMudar(n);
  };
  const excluir = (i: number) => {
    if (ehUltimaMarcada(i)) { setAviso(ULTIMA); return; }
    setAviso(null);
    aoMudar(perguntas.filter((_, j) => j !== i));
  };

  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {perguntas.map((p, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
            <Input aria-label={`Pergunta ${i + 1}`} value={p.texto} className={`${CLASSE_DO_CAMPO} min-w-[12rem] flex-1`}
              onChange={(e) => trocar(i, { texto: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={p.obrigatoria} aria-label={`Pergunta ${i + 1} é obrigatória`}
                onChange={(e) => marcar(i, e.target.checked)} />
              Obrigatória
            </label>
            <Button type="button" variant="ghost" size="sm" aria-label={`Subir pergunta ${i + 1}`} disabled={i === 0} onClick={() => mover(i, -1)}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" aria-label={`Descer pergunta ${i + 1}`} disabled={i === perguntas.length - 1} onClick={() => mover(i, 1)}>
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" aria-label={`Excluir pergunta ${i + 1}`} onClick={() => excluir(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ol>
      {aviso && <p className="text-sm text-amber-700 dark:text-amber-400">{aviso}</p>}
      <Button type="button" variant="outline" size="sm" onClick={() => aoMudar([...perguntas, { texto: '', obrigatoria: false }])}>
        <Plus className="mr-1 h-4 w-4" /> Adicionar pergunta
      </Button>
    </div>
  );
}
