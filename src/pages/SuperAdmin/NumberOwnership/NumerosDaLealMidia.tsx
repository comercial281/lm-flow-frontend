// src/pages/SuperAdmin/NumberOwnership/NumerosDaLealMidia.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import EmptyState from '@/components/base/EmptyState';
import { telefone } from '@/lib/formato';
import numberOwnershipService, { type PlatformNumber } from '@/services/superAdmin/numberOwnershipService';
import { CORPO_SECAO, SECAO, SUBTITULO_SECAO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';
import SeloDaSituacao from './SeloDaSituacao';

// "Números da Leal Mídia" (entrega 4): os números da plataforma (Operacional
// LM01 e afins), que não são de cliente nenhum. Se o Operacional cai, os avisos
// para corretores param — por isso aparecem aqui. Só nome, telefone e situação:
// o servidor nunca manda o token (GET /super/number_ownership/platform_numbers,
// guardado 60 s). Daqui não se reconecta nada.
type Estado = { tipo: 'carregando' } | { tipo: 'pronto'; numeros: PlatformNumber[] } | { tipo: 'erro' };

export default function NumerosDaLealMidia({ recarga }: { recarga: number }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  // Resposta de leitura velha (Atualizar no meio) é descartada.
  const seq = useRef(0);

  const carregar = useCallback(async () => {
    const minha = ++seq.current;
    setEstado({ tipo: 'carregando' });
    try {
      const res = await numberOwnershipService.platformNumbers();
      if (minha !== seq.current) return;
      const dados = res.data.data;
      setEstado(dados.unreadable ? { tipo: 'erro' } : { tipo: 'pronto', numeros: dados.numbers });
    } catch {
      if (minha === seq.current) setEstado({ tipo: 'erro' });
    }
  }, []);

  // `recarga` muda a cada Atualizar da tela.
  useEffect(() => {
    void carregar();
  }, [carregar, recarga]);

  return (
    <section id="numeros-da-leal-midia" aria-labelledby="titulo-numeros-da-leal-midia" className={SECAO}>
      <h2 id="titulo-numeros-da-leal-midia" className={TITULO_SECAO}>Números da Leal Mídia</h2>
      <p className={SUBTITULO_SECAO}>
        Os números da plataforma, fora de qualquer cliente. Se o Operacional cair, os avisos para os corretores param.
      </p>
      <div className={CORPO_SECAO}>
        {estado.tipo === 'carregando' ? (
          <div aria-busy="true" className="h-16 animate-pulse rounded-xl bg-muted" />
        ) : estado.tipo === 'erro' ? (
          <EmptyState
            tipo="erro"
            title="Não consegui ler os números da Leal Mídia"
            aoTentarDeNovo={() => void carregar()}
            className="py-6"
          />
        ) : estado.numeros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum número da Leal Mídia no servidor.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {estado.numeros.map((n, i) => (
              <li key={`${n.name}-${n.phone ?? i}`} className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{n.name}</div>
                  <div className="text-xs text-muted-foreground">{n.phone ? telefone(n.phone) : 'sem telefone gravado'}</div>
                </div>
                <SeloDaSituacao situacao={n.status} desde={n.disconnected_at} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
