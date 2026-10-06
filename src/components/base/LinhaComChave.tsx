// ── LINHA COM CHAVE ──────────────────────────────────────────────────────────
//
// Liga/desliga com efeito na hora (a Chave da casa) + o que depende dela, que só
// aparece ligada (decisão 3 da reestruturação da IA, 06/10/2026). Usa a Chave com
// `semAviso`: quem grava avisa ("Salvo · Desfazer"); erro continua aparecendo pela
// própria Chave, e `aoMudar` devolvendo `false` volta calado.
import type { ReactNode } from 'react';
import Chave from './Chave';

export interface LinhaComChaveProps {
  rotulo: string;
  descricao?: string;
  ligada: boolean;
  aoMudar: (proximo: boolean) => Promise<boolean | void>;
  desabilitada?: boolean;
  /** 'o' → Ligado/Desligado (padrão) · 'a' → Ligada/Desligada */
  genero?: 'o' | 'a';
  children?: ReactNode;
}

export default function LinhaComChave({ rotulo, descricao, ligada, aoMudar, desabilitada, genero, children }: LinhaComChaveProps) {
  return (
    <div className="space-y-4">
      <Chave rotulo={rotulo} descricao={descricao} ligada={ligada} desabilitada={desabilitada} genero={genero} semAviso
        aoMudar={async (v) => ((await aoMudar(v)) === false ? false : undefined)} />
      {ligada && children && <div className="space-y-4">{children}</div>}
    </div>
  );
}
