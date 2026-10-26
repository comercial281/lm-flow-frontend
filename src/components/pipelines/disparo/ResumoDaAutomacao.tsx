import { Checkbox } from '@/components/ui/ds';
import Carregando from '@/components/base/Carregando';
import { CaixaDaJanela } from '@/components/base/janela';
import type { FlowSummary } from '@/services/broadcasts/broadcastsService';
import { linhasDoResumo } from './automacao';

// RESUMO "QUEM RECEBE" DA AUTOMAÇÃO (passo 2 do disparo, 23/10/2026): uma linha
// por grupo, com a contagem. As escolhas ("recebe de novo", "Recomeçar") são
// caixinhas DENTRO das linhas do resumo, nunca botão solto ao lado de texto
// (regra do Tony, 23/10). Linha com zero não aparece.

interface Props {
  /** Null = ainda contando (ou a contagem falhou). */
  resumo: FlowSummary | null;
  contando: boolean;
  erro: boolean;
  /** A prévia voltou sem o resumo da automação (ela não está pronta pra disparar). */
  naoPronta?: boolean;
  /** Quantos recebem com as escolhas de agora. */
  quantos?: number | null;
  /** Frase "N ficaram de fora: ..." (null = ninguém ficou). */
  deFora?: string | null;
  incluirQuemPassou: boolean;
  aoMudarIncluirQuemPassou: (v: boolean) => void;
  recomecarRodando: boolean;
  aoMudarRecomecarRodando: (v: boolean) => void;
}

export default function ResumoDaAutomacao(p: Props) {
  const corpo = () => {
    if (!p.resumo) {
      if (p.erro) {
        return <p className="text-sm text-muted-foreground">Não deu pra contar os destinatários agora. Troque a escolha pra tentar de novo.</p>;
      }
      if (p.naoPronta) {
        return <p className="text-sm text-muted-foreground">Essa automação não está pronta pra disparar. Escolha outra.</p>;
      }
      return <Carregando variante="texto" linhas={2} rotulo="Contando destinatários..." />;
    }
    const linhas = linhasDoResumo(p.resumo, {
      incluirQuemPassou: p.incluirQuemPassou,
      recomecarRodando: p.recomecarRodando,
      deFora: p.deFora,
    });
    const ninguem = p.quantos === 0 || linhas.length === 0;
    return (
      <div className="grid gap-2.5">
      {ninguem && <p className="text-sm text-muted-foreground">Ninguém recebe com essa escolha.</p>}
      <ul aria-label="Quem recebe" className="grid gap-2.5">
        {linhas.map(linha => {
          const id = `disparo-resumo-${linha.chave}`;
          const mudar = linha.chave === 'passou' ? p.aoMudarIncluirQuemPassou : p.aoMudarRecomecarRodando;
          return (
            <li key={linha.chave} className="flex items-start gap-2.5 text-sm">
              {linha.caixinha ? (
                <Checkbox
                  id={id}
                  className="mt-0.5"
                  checked={linha.caixinha.marcada}
                  aria-describedby={linha.ajuda ? `${id}-ajuda` : undefined}
                  onCheckedChange={c => mudar(c === true)}
                />
              ) : (
                <span aria-hidden="true" className="w-4 shrink-0" />
              )}
              <div className="grid gap-0.5">
                {linha.caixinha ? (
                  <label htmlFor={id} className="cursor-pointer">{linha.texto}</label>
                ) : (
                  <span>{linha.texto}</span>
                )}
                {linha.ajuda && (
                  <span id={`${id}-ajuda`} className="text-xs text-muted-foreground">{linha.ajuda}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      </div>
    );
  };

  return (
    <CaixaDaJanela titulo="Quem recebe">
      <div aria-busy={p.contando || undefined}>{corpo()}</div>
    </CaixaDaJanela>
  );
}
