import { Smartphone, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
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

  // Caixa com margem em volta, no topo da lista lateral: Aviso compacto (não Faixa).
  return (
    <Aviso
      tom="atencao"
      compacto
      className="mx-3 mt-3"
      acao={numeros.map((n) => (
        <Button
          key={n.id}
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={() => navigate(enderecoConexao(n.id))}
        >
          {numeros.length === 1 ? RECONECTAR : `${RECONECTAR} ${n.nome}`}
        </Button>
      ))}
    >
      {faixaReconectar(numeros)}
    </Aviso>
  );
}
