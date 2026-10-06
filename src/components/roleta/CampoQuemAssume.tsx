// "Quem assume o lead" nas telas de ORIGEM (formulário do Meta, landing, portal,
// site): um corretor fixo OU uma roleta, na mesma lista, com as abas
// Corretores | Roleta (SeletorComAbas). Roleta nova, 06/10/2026: as telas de
// origem só ESCOLHEM a roleta, nunca criam; o que elas gravam é o mesmo campo que
// a página da roleta mostra como origem.
//
// Regras que vieram de antes e não se reabrem:
// - escolha gravada que saiu da lista (roleta desligada, pessoa fora da equipe)
//   continua escolhida, com o aviso no rótulo. Sem isso a caixa abriria vazia e
//   salvar apagaria a escolha do gestor sem ele ver;
// - leitura de fundo não grita: lista recusada por cargo (`null`) só some com a
//   aba — menos quando a escolha gravada é dela, aí a aba fica só com ela.
import { useMemo } from 'react';
import { Shuffle } from 'lucide-react';
import {
  SeletorComAbas,
  type AbaDoSeletor,
  type EscolhaComAbas,
  type OpcaoComAbas,
} from '@/components/base/SeletorComAbas';
import InicialDoCorretor from '@/components/contacts/InicialDoCorretor';
import { roletaLabel } from '@/services/roletaConfig/roletaConfigService';

/** Os dois campos que toda origem grava. No máximo um preenchido. */
export interface QuemAssume {
  default_assignee_id: string | null;
  roleta_config_id: string | null;
}

export interface PessoaDaLista {
  id: string;
  nome: string;
}

export interface RoletaDaLista {
  id: string;
  is_active: boolean;
  name?: string | null;
  display_name?: string | null;
  inbox_name?: string | null;
}

export const NINGUEM = 'Ninguém (entra sem responsável)';

/**
 * O que está gravado → a escolha da lista. Gravado com os dois (o portal
 * deixava), vale o corretor: é ele que o servidor usa.
 */
export function escolhaDe(v: QuemAssume): EscolhaComAbas | null {
  if (v.default_assignee_id) return { aba: 'corretor', valor: v.default_assignee_id };
  if (v.roleta_config_id) return { aba: 'roleta', valor: v.roleta_config_id };
  return null;
}

/** A escolha da lista → os dois campos, sempre os dois (escolher um limpa o outro). */
export function quemAssumeDe(e: EscolhaComAbas | null): QuemAssume {
  if (e?.aba === 'corretor') return { default_assignee_id: e.valor, roleta_config_id: null };
  if (e?.aba === 'roleta') return { default_assignee_id: null, roleta_config_id: e.valor };
  return { default_assignee_id: null, roleta_config_id: null };
}

const iconeDaRoleta = <Shuffle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />;

export function rotuloDaRoleta(r: RoletaDaLista): string {
  return r.is_active ? roletaLabel(r) : `${roletaLabel(r)} (desligada)`;
}

/** As abas da lista. `null` numa lista = leitura recusada. */
export function abasDeQuemAssume(
  pessoas: PessoaDaLista[] | null,
  roletas: RoletaDaLista[] | null,
  escolha: EscolhaComAbas | null,
): AbaDoSeletor[] {
  const abas: AbaDoSeletor[] = [];

  const naPessoa = escolha?.aba === 'corretor' ? escolha.valor : null;
  if (pessoas !== null || naPessoa) {
    const opcoes: OpcaoComAbas[] = (pessoas ?? []).map(p => ({
      valor: p.id, rotulo: p.nome, icone: <InicialDoCorretor nome={p.nome} />,
    }));
    if (naPessoa && !opcoes.some(o => o.valor === naPessoa)) {
      opcoes.push({ valor: naPessoa, rotulo: 'Responsável escolhido (fora da lista)' });
    }
    abas.push({ chave: 'corretor', rotulo: 'Corretores', vazio: 'Ninguém na equipe ainda.', opcoes });
  }

  const naRoleta = escolha?.aba === 'roleta' ? escolha.valor : null;
  if (roletas !== null || naRoleta) {
    // Só as ligadas, mais a escolhida mesmo desligada.
    const opcoes: OpcaoComAbas[] = (roletas ?? [])
      .filter(r => r.is_active || r.id === naRoleta)
      .map(r => ({ valor: r.id, rotulo: rotuloDaRoleta(r), icone: iconeDaRoleta }));
    if (naRoleta && !opcoes.some(o => o.valor === naRoleta)) {
      opcoes.push({
        valor: naRoleta,
        rotulo: roletas === null ? 'Roleta escolhida' : 'Roleta escolhida (não existe mais)',
        icone: iconeDaRoleta,
      });
    }
    abas.push({ chave: 'roleta', rotulo: 'Roleta', vazio: 'Nenhuma roleta ligada.', opcoes });
  }

  return abas;
}

interface Props {
  id?: string;
  'aria-label': string;
  value: QuemAssume;
  onChange: (v: QuemAssume) => void;
  pessoas: PessoaDaLista[] | null;
  roletas: RoletaDaLista[] | null;
  /** O texto do vazio. Padrão: "Ninguém (entra sem responsável)". */
  nenhum?: string;
  disabled?: boolean;
}

export default function CampoQuemAssume({
  id, 'aria-label': ariaLabel, value, onChange, pessoas, roletas, nenhum = NINGUEM, disabled,
}: Props) {
  const escolha = escolhaDe(value);
  const abas = useMemo(() => abasDeQuemAssume(pessoas, roletas, escolha), [pessoas, roletas, escolha?.aba, escolha?.valor]); // eslint-disable-line react-hooks/exhaustive-deps
  const roletaEscolhida = escolha?.aba === 'roleta' ? roletas?.find(r => r.id === escolha.valor) : undefined;

  return (
    <div className="space-y-1.5">
      <SeletorComAbas
        id={id}
        aria-label={ariaLabel}
        abas={abas}
        value={escolha}
        onChange={e => onChange(quemAssumeDe(e))}
        nenhum={{ rotulo: nenhum, aoEscolher: () => onChange(quemAssumeDe(null)) }}
        disabled={disabled}
      />
      {roletaEscolhida && !roletaEscolhida.is_active && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Esta roleta está desligada: enquanto ela não for religada, o lead entra sem responsável.
        </p>
      )}
    </div>
  );
}
