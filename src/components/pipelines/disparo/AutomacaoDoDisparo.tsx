import { useCallback, useEffect, useRef, useState } from 'react';
import EmptyState from '@/components/base/EmptyState';
import Carregando from '@/components/base/Carregando';
import Aviso from '@/components/base/Aviso';
import { Seletor } from '@/components/base/Seletor';
import { CampoDaJanela } from '@/components/base/janela';
import { broadcastsService, type AutomationOption } from '@/services/broadcasts/broadcastsService';
import { avisoDoGatilho, inicioDaPrevia, maisBlocos, numeroProprio } from './automacao';

// AUTOMAÇÃO NO DISPARO EM MASSA (23/10/2026): as automações que dá pra disparar
// (o servidor já recorta), a linha do número quando ela tem número próprio, a
// prévia em UMA linha de altura fixa (fluxo grande não cresce a janela) e o
// aviso de dado que só o gatilho traz. O lead entra na automação na vez dele.

export const SEM_NUMERO_DO_FLUXO = 'Escolha o número nas Configurações da automação pra poder disparar.';

interface Props {
  /** A automação escolhida ('' = nenhuma). */
  automacaoId: string;
  aoEscolher: (automacao: AutomationOption | null) => void;
}

function rotuloDaOpcao(o: AutomationOption): string {
  const nome = !o.team && o.owner_name ? `${o.name} · ${o.owner_name}` : o.name;
  return o.number_mode === 'per_block' ? `${nome} · ${SEM_NUMERO_DO_FLUXO}` : nome;
}

export default function AutomacaoDoDisparo({ automacaoId, aoEscolher }: Props) {
  const [opcoes, setOpcoes] = useState<AutomationOption[] | null>(null);
  const [erro, setErro] = useState(false);
  // "Tentar de novo" duas vezes: a resposta velha não sobrescreve a nova.
  const ultimaCarga = useRef(0);

  const carregar = useCallback(() => {
    const vez = ++ultimaCarga.current;
    setErro(false);
    setOpcoes(null);
    broadcastsService
      .automationOptions()
      .then(lista => { if (vez === ultimaCarga.current) setOpcoes(lista); })
      .catch(() => { if (vez === ultimaCarga.current) setErro(true); });
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (erro) return <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={carregar} className="p-4" />;
  if (!opcoes) return <Carregando variante="texto" linhas={2} rotulo="Carregando as automações…" />;
  if (opcoes.length === 0) {
    return (
      <EmptyState
        tamanho="compacto"
        title="Nenhuma automação ligada ainda."
        description="Ligue uma automação em Automações pra disparar por aqui."
        className="p-4"
      />
    );
  }

  const escolhida = opcoes.find(o => o.id === automacaoId) ?? null;
  const numero = escolhida ? numeroProprio(escolhida) : null;
  const daEquipe = opcoes.filter(o => o.team);
  const pessoais = opcoes.filter(o => !o.team);
  const opcao = (o: AutomationOption) => (
    <option key={o.id} value={o.id} disabled={o.number_mode === 'per_block'}>{rotuloDaOpcao(o)}</option>
  );
  const mais = escolhida ? maisBlocos(escolhida) : null;
  const aviso = escolhida ? avisoDoGatilho(escolhida.trigger_data) : null;

  return (
    <>
      <CampoDaJanela
        rotulo="Automação"
        htmlFor="disparo-automacao"
        ajuda={numero ? `Sai pelo número da automação: ${numero}. O número escolhido no passo 1 não vale pra ela.` : undefined}
      >
        <Seletor
          id="disparo-automacao"
          className="w-full"
          value={automacaoId}
          onChange={e => aoEscolher(opcoes.find(o => o.id === e.target.value) ?? null)}
        >
          <option value="">Escolher automação</option>
          {daEquipe.length > 0 && <optgroup label="Da equipe">{daEquipe.map(opcao)}</optgroup>}
          {pessoais.length > 0 && <optgroup label="Pessoais">{pessoais.map(opcao)}</optgroup>}
        </Seletor>
      </CampoDaJanela>

      {escolhida && (
        <p
          data-testid="previa-da-automacao"
          className="flex h-9 items-center overflow-hidden whitespace-nowrap rounded-lg bg-muted/40 px-3 text-sm"
        >
          <span className="min-w-0 truncate">{inicioDaPrevia(escolhida)}</span>
          {mais && (
            <>
              <span className="shrink-0 whitespace-pre text-muted-foreground">{' · '}</span>
              <a
                href={`/automations/flow-builder/${escolhida.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-primary underline-offset-2 hover:underline"
              >
                {mais}
              </a>
            </>
          )}
        </p>
      )}

      {aviso && <Aviso tom="info" compacto>{aviso}</Aviso>}
    </>
  );
}
