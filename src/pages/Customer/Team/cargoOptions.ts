import type { CustomRole } from '@/types/customRoles';

/* Os cargos oferecidos na tela de Equipe.
 *
 * ⚠️ NÃO trocar por "só lista o que vem do banco". A tabela de cargos nasce
 * VAZIA em cada cliente: o schema é clonado do Principal sem dados, e o
 * preenchimento automático dos três cargos de fábrica roda só no Principal
 * (quem espalha para os clientes é o botão de re-aplicar cargos do painel da
 * Leal Mídia, que nem todo cliente recebeu). A tela antiga não sofria porque
 * tinha os três escritos no código; a nova passou a ler do banco e, no cliente
 * sem cargos gravados, o seletor ficou VAZIO — ninguém conseguia definir cargo
 * de ninguém.
 *
 * Então: os três de fábrica estão sempre disponíveis. Quando existem no banco,
 * vale o do banco (nome e permissões que o cliente editou); quando não existem,
 * entra a versão de reserva, que grava pelo caminho legado — exatamente o que a
 * tela fazia antes. Cargos próprios do cliente entram por cima. */

export interface CargoOption {
  /** identificador só para a lista da tela */
  key: string;
  label: string;
  description?: string;
  /** quando existe cargo gravado, é ele que mandamos */
  customRoleId?: string | number | null;
  /** reserva: grava pelo cargo legado quando o cliente não tem o cargo gravado */
  chaveRole?: 'admin' | 'manager' | 'agent';
  /** Administrador alcança toda instância sem precisar de liberação */
  seesAllInboxes: boolean;
}

const FACTORY: Array<{ slug: string; label: string; description: string; chaveRole: 'admin' | 'manager' | 'agent' }> = [
  {
    slug: 'administrador',
    label: 'Administrador',
    description: 'Acesso total: configurações, equipe, todas as instâncias.',
    chaveRole: 'admin',
  },
  {
    slug: 'gerente',
    label: 'Gerente',
    description: 'Gerencia leads, funil e relatórios do time.',
    chaveRole: 'manager',
  },
  {
    slug: 'corretor',
    label: 'Corretor',
    description: 'Atende leads. Só vê as instâncias que você liberar.',
    chaveRole: 'agent',
  },
];

const CHAVE_BY_SLUG: Record<string, 'admin' | 'manager' | 'agent'> = {
  administrador: 'admin',
  gerente: 'manager',
  corretor: 'agent',
};

/** Monta a lista para a tela: os três de fábrica primeiro, cargos próprios depois. */
export function buildCargoOptions(roles: CustomRole[]): CargoOption[] {
  const bySlug = new Map(roles.map(r => [r.slug, r]));

  const factory = FACTORY.map(f => {
    const saved = bySlug.get(f.slug);
    return saved
      ? {
        key: `role:${saved.id}`,
        label: saved.name,
        description: saved.description || f.description,
        customRoleId: saved.id,
        chaveRole: f.chaveRole,
        seesAllInboxes: f.slug === 'administrador',
      }
      : {
        key: `chave:${f.chaveRole}`,
        label: f.label,
        description: f.description,
        chaveRole: f.chaveRole,
        seesAllInboxes: f.slug === 'administrador',
      };
  });

  const proprios = roles
    .filter(r => !CHAVE_BY_SLUG[r.slug])
    .map(r => ({
      key: `role:${r.id}`,
      label: r.name,
      description: r.description || undefined,
      customRoleId: r.id,
      seesAllInboxes: false,
    }));

  return [...factory, ...proprios];
}

/** O que mandar para a API ao escolher esta opção. */
export function cargoPayload(option: CargoOption): Record<string, unknown> {
  return option.customRoleId != null
    ? { custom_role_id: option.customRoleId }
    : { chave_role: option.chaveRole };
}

/** Esta opção é o cargo que a pessoa já tem? */
export function isCargoSelected(
  option: CargoOption,
  current: { custom_role_id?: string | number | null; key?: string; chave_role?: string },
): boolean {
  if (option.customRoleId != null && current.custom_role_id != null) {
    return String(option.customRoleId) === String(current.custom_role_id);
  }
  // Sem cargo gravado, o que identifica a pessoa é o cargo legado — é assim que
  // o cliente que nunca recebeu os cargos no banco continua vendo a marcação
  // certa em vez de nenhuma.
  if (current.custom_role_id == null && option.chaveRole) {
    return option.chaveRole === current.chave_role;
  }
  return false;
}
