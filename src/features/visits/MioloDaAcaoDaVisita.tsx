// Miolo das janelas de ação da visita (Marcar como realizada, Dar retorno e
// Cancelar visita). Peça única: o card do lead / Lista (`AcoesDaVisita`) e o
// calendário (`Visits`) usam esta mesma, com os mesmos textos e o mesmo visual.
// Aqui só tem disposição e letra; quem grava (e o que grava) é de quem usa a peça.
import { Star } from 'lucide-react';
import { Textarea } from '@/components/ui/ds';
import { CampoDaJanela, GrupoDaJanela } from '@/components/base/janela';

/** Nota de 1 a 5 estrelas e o retorno do cliente (realizada e dar retorno). */
export function MioloDoRetornoDaVisita({ nota, aoMudarNota, comentario, aoMudarComentario }: {
  nota: number;
  aoMudarNota: (n: number) => void;
  comentario: string;
  aoMudarComentario: (c: string) => void;
}) {
  return (
    <GrupoDaJanela titulo="Retorno da visita">
      <CampoDaJanela rotulo="Avaliação" ajuda="De 1 a 5 estrelas">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => aoMudarNota(n)}
              aria-pressed={n === nota}
              aria-label={`Avaliar com ${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
              title={`Avaliar com ${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
            >
              <Star className={`h-6 w-6 ${n <= nota ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
            </button>
          ))}
        </div>
      </CampoDaJanela>
      <CampoDaJanela rotulo="Retorno do cliente" htmlFor="visita-retorno-comentario">
        <Textarea
          id="visita-retorno-comentario"
          value={comentario}
          onChange={e => aoMudarComentario(e.target.value)}
          rows={3}
          placeholder="Como foi a visita? Interesse do cliente?"
          className="resize-none"
        />
      </CampoDaJanela>
    </GrupoDaJanela>
  );
}

/** Motivo (opcional) do cancelamento. */
export function MioloDoCancelamentoDaVisita({ motivo, aoMudarMotivo }: {
  motivo: string;
  aoMudarMotivo: (m: string) => void;
}) {
  return (
    <GrupoDaJanela titulo="Cancelamento">
      <CampoDaJanela rotulo="Motivo do cancelamento" htmlFor="visita-cancelamento-motivo">
        <Textarea
          id="visita-cancelamento-motivo"
          value={motivo}
          onChange={e => aoMudarMotivo(e.target.value)}
          rows={3}
          placeholder="Opcional"
          className="resize-none"
        />
      </CampoDaJanela>
    </GrupoDaJanela>
  );
}
