/**
 * "IA que atende" da janela da campanha. Só leitura (decisão do dono, 04/11/2026): mostra o que o servidor diz de cada IA
 * e leva pra IA, onde a configuração mora. Nenhuma regra mora aqui: ver `qualIaAtende.ts`.
 * Exceção: a IA que veio de uma ficha copiada aparece antes do Criar, que a grava.
 */
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import type { IaDaCampanha } from '@/services/campanhas/campanhasService';
import { donoEmTexto, maiuscula } from '@/features/campanhas/qualIaAtende';

export interface QuemAtendeProps {
  donos: IaDaCampanha[];
  /** Pra onde "Configurar na IA" leva. Nulo = a pessoa não pode ver a tela da IA, então não há link. */
  linkDaIa: string | null;
  /** Formulário ainda não criado. */
  novo?: boolean;
  /** Formulário novo copiado de outra ficha: a IA que vem junto e entra no Criar. */
  daCopia?: string | null;
  /** A lista de campanhas ainda não chegou (ou falhou): não afirma "Sem IA", mostra "—" como a linha. */
  semLista?: boolean;
  /** Anúncio que ainda não tem linha: a página da IA só lista anúncio com linha. */
  semLinha?: boolean;
  ocupado?: boolean;
  /** A pergunta do 409: a campanha sai de outra IA. */
  movendo?: { chave: string; frase: string } | null;
  aoMover?: () => void;
  aoDeixar?: () => void;
  aviso?: string | null;
  ficouSemIa?: string[];
}

export default function QuemAtende({
  donos, linkDaIa, novo = false, semLista = false, semLinha = false, daCopia = null, ocupado = false, movendo = null, aoMover, aoDeixar, aviso, ficouSemIa = [],
}: QuemAtendeProps) {
  return (
    <div className="grid gap-3">
      {donos.length === 0 ? (
        !novo && <p className="text-sm text-muted-foreground">{semLista ? '—' : 'Sem IA'}</p>
      ) : (
        <ul className="grid gap-2">
          {donos.map((d) => (
            <li key={`${d.sales_agent_id}|${d.sales_agent_number_id ?? ''}`} className="rounded-md border border-border px-3 py-2 text-sm">
              {d.reason ? (
                <span className="grid min-w-0">
                  <span className="truncate">{d.number_label ? `${d.name} · ${d.number_label}` : d.name}</span>
                  <span className="text-xs text-muted-foreground">{maiuscula(d.reason)}</span>
                </span>
              ) : (
                <span className="min-w-0 truncate">{donoEmTexto(d)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {novo && daCopia && (
        <div className="grid gap-1 rounded-md border border-border px-3 py-2 text-sm">
          <span>Vem da ficha copiada: {daCopia}</span>
          <span className="text-xs text-muted-foreground">Grava junto quando você clicar em Criar.</span>
        </div>
      )}
      {novo && !daCopia && (
        <Aviso tom="atencao" compacto>
          <p>IA que usa lista de formulários só atende depois de marcar este formulário nela.</p>
          <p className="mt-1 text-xs">IA que atende por funil ou por todo anúncio continua atendendo.</p>
        </Aviso>
      )}
      {semLinha && !novo && <p className="text-xs text-muted-foreground">Salve este anúncio para ele aparecer na lista da IA.</p>}
      {movendo && (
        <Aviso tom="atencao" titulo="Mover a campanha de IA?">
          <p>{movendo.frase}</p>
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" disabled={ocupado} onClick={() => aoMover?.()}>Mover</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => aoDeixar?.()}>Deixar como está</Button>
          </div>
        </Aviso>
      )}
      {aviso && <Aviso tom="atencao" compacto>{aviso}</Aviso>}
      {ficouSemIa.length > 0 && <Aviso tom="atencao" compacto>Ficou sem IA: {ficouSemIa.join(', ')}.</Aviso>}
      {linkDaIa && (
        <p className="text-sm">
          <Link to={linkDaIa} className="font-medium text-primary underline-offset-4 hover:underline">Configurar na IA</Link>
        </p>
      )}
    </div>
  );
}
