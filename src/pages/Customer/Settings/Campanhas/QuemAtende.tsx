/**
 * "Quem atende" da janela da campanha (Tarefa 4, 04/11/2026). Mostra o que o servidor diz de cada IA e só
 * oferece botão quando ele muda alguma coisa. Nenhuma regra mora aqui: ver `qualIaAtende.ts`.
 */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import { Seletor } from '@/components/base/Seletor';
import type { IaDaCampanha } from '@/services/campanhas/campanhasService';
import { donoEmTexto, maiuscula, podeTirar, type OpcaoNaTela } from '@/features/campanhas/qualIaAtende';

export interface QuemAtendeProps {
  donos: IaDaCampanha[];
  opcoes: OpcaoNaTela[];
  podeMexer: boolean;
  /** Formulário ainda não criado: a escolha grava junto no Criar. */
  novo?: boolean;
  aoEscolher: (chave: string) => void;
  aoTirar: (dono: IaDaCampanha) => void;
  ocupado?: boolean;
  /** A pergunta do 409: a campanha sai de outra IA. */
  movendo?: { chave: string; frase: string } | null;
  aoMover?: () => void;
  aoDeixar?: () => void;
  aviso?: string | null;
  ficouSemIa?: string[];
}

export default function QuemAtende({
  donos, opcoes, podeMexer, novo = false, aoEscolher, aoTirar, ocupado = false, movendo = null, aoMover, aoDeixar, aviso, ficouSemIa = [],
}: QuemAtendeProps) {
  const [escolhida, setEscolhida] = useState('');
  // Depois de gravar, os donos mudam: a escolha feita já foi usada.
  useEffect(() => { setEscolhida(''); }, [donos]);

  return (
    <div className="grid gap-3">
      {donos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem IA</p>
      ) : (
        <ul className="grid gap-2">
          {donos.map((d) => (
            <li key={`${d.sales_agent_id}|${d.sales_agent_number_id ?? ''}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              {d.reason ? (
                <span className="grid min-w-0">
                  <span className="truncate">{d.number_label ? `${d.name} · ${d.number_label}` : d.name}</span>
                  <span className="text-xs text-muted-foreground">{maiuscula(d.reason)}</span>
                </span>
              ) : (
                <span className="min-w-0 truncate">{donoEmTexto(d)}</span>
              )}
              {podeMexer && podeTirar(d) && (
                <Button type="button" variant="ghost" size="sm" disabled={ocupado} aria-label={`Tirar a IA ${d.name}`} onClick={() => aoTirar(d)}>Tirar a IA</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {podeMexer && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <Seletor aria-label="Pôr numa IA" value={escolhida} disabled={ocupado}
              onChange={(e) => { setEscolhida(e.target.value); aoDeixar?.(); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Pôr numa IA...</option>
              {opcoes.filter((o) => !o.jaAtende).map((o) => (
                <option key={o.chave} value={o.chave} disabled={o.fixa}>{o.rotulo}</option>
              ))}
            </Seletor>
          </div>
          <Button type="button" variant="outline" disabled={!escolhida || ocupado} onClick={() => aoEscolher(escolhida)}>Pôr</Button>
        </div>
      )}
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
      {podeMexer && (
        <p className="text-xs text-muted-foreground">
          {novo ? 'A escolha grava junto quando você clicar em Criar.' : 'Esta escolha vale na hora, sem esperar o Salvar.'}
        </p>
      )}
      <p className="text-xs text-muted-foreground">As regras da IA ficam em IA Vendedora &gt; Configurar &gt; Campanhas e gatilhos.</p>
    </div>
  );
}
