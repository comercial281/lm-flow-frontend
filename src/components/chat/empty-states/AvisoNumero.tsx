import { AlertTriangle, Smartphone, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@evoapi/design-system/button';
import EmptyState from '@/components/base/EmptyState';
import {
  CONECTAR_AGORA, RECONECTAR, SEM_NUMERO_CORRETOR, SEM_NUMERO_GESTOR, SEM_NUMERO_GESTOR_SEM_CRIAR,
  enderecoConexao, faixaReconectar, fraseForaDoAr, tituloForaDoAr,
  type AvisoListaVazia, type NumeroForaDoAr,
} from '@/features/numbers/avisoConversas';

// A caixa de Conversas sem número no ar (02/10/2026). A regra mora em
// `features/numbers/avisoConversas.ts`, com spec; aqui só se desenha.

/** No lugar de "Não há conversas disponíveis", quando o motivo é o número. */
export function AvisoListaVaziaNumero({ aviso }: { aviso: AvisoListaVazia }) {
  const navigate = useNavigate();

  if (aviso.tipo === 'semNumero') {
    if (!aviso.gestor) {
      return <EmptyState icon={Smartphone} title={SEM_NUMERO_CORRETOR.title} description={SEM_NUMERO_CORRETOR.description} />;
    }
    if (!aviso.podeCriar) {
      return (
        <EmptyState
          icon={Smartphone}
          title={SEM_NUMERO_GESTOR_SEM_CRIAR.title}
          description={SEM_NUMERO_GESTOR_SEM_CRIAR.description}
        />
      );
    }
    return (
      <EmptyState
        icon={Smartphone}
        title={SEM_NUMERO_GESTOR.title}
        description={SEM_NUMERO_GESTOR.description}
        action={{ label: SEM_NUMERO_GESTOR.acao, onClick: () => navigate('/channels/new') }}
      />
    );
  }

  const { numeros } = aviso;
  if (numeros.length === 1) {
    return (
      <EmptyState
        icon={WifiOff}
        title={tituloForaDoAr(numeros)}
        description={fraseForaDoAr(numeros)}
        action={{ label: CONECTAR_AGORA, onClick: () => navigate(enderecoConexao(numeros[0].id)) }}
      />
    );
  }
  return (
    <div>
      <EmptyState icon={WifiOff} title={tituloForaDoAr(numeros)} description={fraseForaDoAr(numeros)} className="pb-4" />
      <ul className="space-y-2 px-2">
        {numeros.map((n) => (
          <li key={n.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left">
            <span className="truncate text-sm">{n.nome}</span>
            <Button size="sm" variant="outline" onClick={() => navigate(enderecoConexao(n.id))}>
              {CONECTAR_AGORA}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Em cima da lista que JÁ tem conversas: o número caiu, nada novo chega. */
export function FaixaReconectar({ numeros }: { numeros: NumeroForaDoAr[] }) {
  const navigate = useNavigate();
  if (numeros.length === 0) return null;

  return (
    <div
      role="status"
      className="mx-3 mt-3 flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{faixaReconectar(numeros)}</span>
      </div>
      <div className="flex flex-wrap gap-2 pl-6">
        {numeros.map((n) => (
          <Button
            key={n.id}
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => navigate(enderecoConexao(n.id))}
          >
            {numeros.length === 1 ? RECONECTAR : `${RECONECTAR} ${n.nome}`}
          </Button>
        ))}
      </div>
    </div>
  );
}
