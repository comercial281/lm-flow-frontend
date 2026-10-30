import React from 'react';

/**
 * Fundo vivo da Dashboard (Vidro violeta, 30/10/2026): grade fraca e, no escuro,
 * bolhas roxas que derivam devagar. Fica atrás de tudo, sem clique; enquanto ele
 * está na tela a casca do app fica transparente (dashboard-nova.css).
 */
export const FundoVivo: React.FC = () => (
  <div className="lmfn-fundo-vivo" aria-hidden="true">
    <div className="lmfn-fundo-vivo-grade" />
    <div className="lmfn-bolha lmfn-bolha-a" />
    <div className="lmfn-bolha lmfn-bolha-b" />
    <div className="lmfn-bolha lmfn-bolha-c" />
  </div>
);
