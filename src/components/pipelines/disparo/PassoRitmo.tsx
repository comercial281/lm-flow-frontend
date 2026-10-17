import Aviso from '@/components/base/Aviso';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import { GrupoDaJanela } from '@/components/base/janela';
import { plural } from '@/lib/formato';
import type { BroadcastPace } from '@/services/broadcasts/broadcastsService';
import { LISTA_GRANDE, PACOTES, previsaoDoPacote, rotuloDoPacote } from './ritmo';

// PASSO 3 DO DISPARO (16/10/2026): o ritmo em 3 pacotes. Os números de
// intervalo, lote e pausa moram no servidor; a tela só mostra o efeito e a
// previsão de término. Os limites (horário comercial, quem pediu pra parar,
// 7 dias sem receber) são fixos nas campanhas novas.

interface Props {
  pace: BroadcastPace;
  aoEscolher: (pace: BroadcastPace) => void;
  quantidade: number;
  eta: Partial<Record<BroadcastPace, string>>;
}

export default function PassoRitmo({ pace, aoEscolher, quantidade, eta }: Props) {
  const previsao = previsaoDoPacote(eta, pace);
  return (
    <div className="grid gap-5">
      <GrupoDaJanela titulo="Ritmo">
        <CartoesDeEscolha<BroadcastPace>
          rotulo="Ritmo"
          colunas={3}
          valor={pace}
          aoEscolher={aoEscolher}
          opcoes={PACOTES}
        />
      </GrupoDaJanela>

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
