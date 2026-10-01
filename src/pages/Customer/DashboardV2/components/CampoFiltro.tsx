import React from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  /** Nome visível em cima da caixa ("Corretor", "Etiqueta"...). */
  rotulo: string;
  /** Id do <select> de dentro: o rótulo vira <label htmlFor>. Sem id, é um grupo com o rótulo como nome (para botão). */
  id?: string;
  /** Id do rótulo, usado no grupo quando não há select. */
  idRotulo?: string;
  icone?: React.ReactNode;
  /** Seta à direita: só para lista que abre (select), nunca para botão liga/desliga. */
  seta?: boolean;
  children: React.ReactNode;
}

/**
 * Um filtro com o rótulo em cima e a caixa de 40 px embaixo (ícone à esquerda,
 * seta à direita). Os seletores só desenham assim quando recebem `rotulo`
 * (Dashboard nova); sem ele, o desenho de sempre (DashboardV2 não muda).
 * Visual em lmf.css (`.lmf-campo`).
 */
export const CampoFiltro: React.FC<Props> = ({ rotulo, id, idRotulo, icone, seta = true, children }) => {
  const caixa = (
    <div className={`lmf-campo-caixa${icone ? '' : ' lmf-campo-sem-icone'}`}>
      {icone && <span className="lmf-campo-icone" aria-hidden>{icone}</span>}
      {children}
      {seta && <ChevronDown size={14} aria-hidden className="lmf-campo-seta" />}
    </div>
  );
  if (id) {
    return (
      <div className="lmf-campo">
        <label htmlFor={id} className="lmf-campo-rotulo">{rotulo}</label>
        {caixa}
      </div>
    );
  }
  return (
    <div className="lmf-campo" role="group" aria-labelledby={idRotulo}>
      <span id={idRotulo} className="lmf-campo-rotulo">{rotulo}</span>
      {caixa}
    </div>
  );
};

export default CampoFiltro;
