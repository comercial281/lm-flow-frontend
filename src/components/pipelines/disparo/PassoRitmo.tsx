import Aviso from '@/components/base/Aviso';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import { GrupoDaJanela } from '@/components/base/janela';
import { Checkbox, Input } from '@/components/ui/ds';
import { plural } from '@/lib/formato';
import type { BroadcastPace } from '@/services/broadcasts/broadcastsService';
import { LIMITE_MAX, LIMITE_MIN } from './agenda';
import { LISTA_GRANDE, PACOTES, rotuloDoPacote } from './ritmo';

// PASSO 3 DO DISPARO (16/10/2026): o ritmo em 3 pacotes. Os números de
// intervalo, lote e pausa moram no servidor; a tela só mostra o efeito e a
// previsão de término. Os limites fixos (horário comercial, quem pediu pra
// parar, 7 dias sem receber) seguem valendo.
//
// LIMITE POR DIA (10/11/2026, pedido do dono): caixinha desligada embaixo dos
// cartões; ligada, "Até [20] por dia". A escolha mora dentro do passo, sem
// botão solto. A previsão já vem com o limite e o início agendado.

interface Props {
  pace: BroadcastPace;
  aoEscolher: (pace: BroadcastPace) => void;
  quantidade: number;
  /** "termina amanhã por volta das 15h", ou null sem previsão. */
  previsao: string | null;
  limiteLigado: boolean;
  aoLigarLimite: (ligado: boolean) => void;
  limite: string;
  aoMudarLimite: (texto: string) => void;
  erroDoLimite: string;
}

export default function PassoRitmo(p: Props) {
  const { pace, quantidade, previsao } = p;
  return (
    <div className="grid gap-5">
      <GrupoDaJanela titulo="Ritmo">
        <CartoesDeEscolha<BroadcastPace>
          rotulo="Ritmo"
          colunas={3}
          valor={pace}
          aoEscolher={p.aoEscolher}
          opcoes={PACOTES}
        />
      </GrupoDaJanela>

      <div className="grid gap-2">
        <div className="flex items-start gap-2.5 text-sm">
          <Checkbox
            id="disparo-limite-ligado"
            className="mt-0.5"
            checked={p.limiteLigado}
            aria-describedby="disparo-limite-ajuda"
            onCheckedChange={c => p.aoLigarLimite(c === true)}
          />
          <div className="grid gap-0.5">
            <label htmlFor="disparo-limite-ligado" className="cursor-pointer font-medium">Limite por dia</label>
            <span id="disparo-limite-ajuda" className="text-xs text-muted-foreground">
              Bateu o limite, o disparo para e continua no próximo dia útil às 8h.
            </span>
          </div>
        </div>
        {p.limiteLigado && (
          <div className="grid gap-1 pl-[26px]">
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="disparo-limite" className="sr-only">Quantos por dia</label>
              <span aria-hidden="true">Até</span>
              <Input
                id="disparo-limite"
                type="number"
                inputMode="numeric"
                min={LIMITE_MIN}
                max={LIMITE_MAX}
                step={1}
                value={p.limite}
                onChange={e => p.aoMudarLimite(e.target.value)}
                aria-invalid={p.erroDoLimite ? true : undefined}
                className="h-9 w-24"
              />
              <span aria-hidden="true">por dia</span>
            </div>
            {p.erroDoLimite && <p role="alert" className="text-xs text-destructive">{p.erroDoLimite}</p>}
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {plural(quantidade, 'lead', 'leads')} no ritmo {rotuloDoPacote(pace)}
        {previsao ? `: ${previsao}` : '.'}
      </p>

      {quantidade > LISTA_GRANDE && (
        <Aviso tom="info" compacto>
          Quanto maior a lista, mais devagar: o risco de bloqueio do número é menor.
        </Aviso>
      )}
    </div>
  );
}
