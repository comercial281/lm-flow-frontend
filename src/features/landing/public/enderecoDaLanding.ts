// src/features/landing/public/enderecoDaLanding.ts
// Em que endereço a landing de anúncio abre.
//
// Cada `<cliente>.lmflow.com.br` é a área daquele cliente no sistema, e o
// `app`/`lmflow.com.br` são do painel. A landing é conteúdo de UM cliente, então
// no endereço lmflow ela só abre no endereço desse cliente:
//
//   renato.lmflow.com.br/lp/renato/oferta   → abre (é o link que o CRM copia);
//   app.lmflow.com.br/lp/renato/oferta      → vai para renato.lmflow.com.br/lp/renato/oferta;
//   outro.lmflow.com.br/lp/renato/oferta    → idem;
//   lmflow.com.br/lp/renato/oferta          → idem.
//
// A busca (UTMs, fbclid) e a âncora vão junto. Domínio próprio do cliente,
// localhost, IP e prévia da Vercel (*.vercel.app) ficam como estão.
//
// Lido pela entrada enxuta da landing (src/lp), pelo middleware da Vercel
// (imports relativos, runtime de borda) e pelo CRM. Não importar nada além de
// `dominioDoSite` aqui.
import { limparHost } from '../../siteBuilder/public/dominioDoSite';

export type EnderecoDaLanding =
  /** Já está no endereço certo (ou fora do lmflow): monta a página. */
  | { tipo: 'montar' }
  /** Endereço lmflow de outro cliente ou do painel: vai para o do cliente. */
  | { tipo: 'redirecionar'; url: string }
  /** O cliente do caminho não tem endereço possível: não monta nem redireciona. */
  | { tipo: 'indisponivel' };

export interface LocalDaLanding {
  hostname: string;
  pathname: string;
  search?: string;
  hash?: string;
}

const DOMINIO = 'lmflow.com.br';

// Os mesmos de `src/services/core/tenant.ts` (que não pode ser importado daqui):
// nesses o sistema não vê cliente, e redirecionar para eles daria laço.
const RESERVADOS = new Set(['www', 'app', 'api', 'admin', 'staging', 'production', 'localhost', 'lmflow']);

/** Um rótulo de endereço válido: letras, números e hífen no meio (ex.: `016-imoveis`). */
const ROTULO = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** O endereço lmflow do cliente, ou null quando o nome não pode virar endereço. */
export function enderecoDoCliente(tenant: string): string | null {
  const cliente = (tenant || '').trim().toLowerCase();
  if (!ROTULO.test(cliente) || RESERVADOS.has(cliente)) return null;
  return `${cliente}.${DOMINIO}`;
}

/** Decide se a landing de `tenant` monta neste endereço ou vai para o do cliente. */
export function enderecoDaLanding(local: LocalDaLanding, tenant: string): EnderecoDaLanding {
  const host = limparHost(local.hostname);
  if (host !== DOMINIO && !host.endsWith(`.${DOMINIO}`)) return { tipo: 'montar' };

  const destino = enderecoDoCliente(tenant);
  if (!destino) return { tipo: 'indisponivel' };
  if (host === destino) return { tipo: 'montar' };

  const caminho = local.pathname.startsWith('/') ? local.pathname : `/${local.pathname}`;
  return { tipo: 'redirecionar', url: `https://${destino}${caminho}${local.search ?? ''}${local.hash ?? ''}` };
}
