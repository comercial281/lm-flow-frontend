import { describe, it, expect } from 'vitest';
import { filtrarCartoes, filtroValido, ordenarCartoes, problemasPorCliente, seloDeProblema } from './lista';
import type { ClientePooled } from '@/types/admin/clientes';
import type { Atencao } from '@/types/admin/overview';

const cliente = (extra: Partial<ClientePooled>): ClientePooled => ({
  id: extra.slug ?? 'x', name: 'X', slug: 'x', schema_name: 'tenant_x', status: 'active', situation: 'ativo',
  members: 1, login_url: '', ...extra,
});

const atencao = (clients: Atencao['clients']): Atencao => ({
  counts: { ativo: 0, provisionando: 0, congelado: 0, com_erro: 0 }, clients, ok_count: 0, generated_at: '', unreadable: [],
});

describe('lista de clientes', () => {
  const a = cliente({ id: '1', name: 'Bravo', slug: 'bravo', schema_name: 'tenant_bravo' });
  const b = cliente({ id: '2', name: 'alfa', slug: 'alfa', schema_name: 'tenant_alfa' });
  const c = cliente({ id: '3', name: 'Charlie', slug: 'charlie', schema_name: 'tenant_charlie' });
  const problemas = problemasPorCliente(atencao([
    { schema: 'tenant_charlie', name: 'Charlie', slug: 'charlie', severity: 'vermelho',
      problems: [{ kind: 'numero_caido', severity: 'vermelho', numbers: [{ inbox_id: 1, name: 'P', phone: null, since: null }] }] },
  ]));

  it('quem tem problema vem primeiro, depois por nome sem diferença de maiúscula', () => {
    expect(ordenarCartoes([a, b, c], problemas).map((t) => t.name)).toEqual(['Charlie', 'alfa', 'Bravo']);
  });

  it('filtra por problema e por busca no nome', () => {
    expect(filtrarCartoes([a, b, c], 'com_problema', '', problemas).map((t) => t.name)).toEqual(['Charlie']);
    expect(filtrarCartoes([a, b, c], 'todos', 'ALF', problemas).map((t) => t.name)).toEqual(['alfa']);
  });

  it('filtro inválido vira todos', () => {
    expect(filtroValido('arquivados')).toBe('arquivados');
    expect(filtroValido('xyz')).toBe('todos');
    expect(filtroValido(null)).toBe('todos');
  });

  it('selo resume o problema mais grave', () => {
    expect(seloDeProblema(problemas.get('charlie')!)).toBe('1 número caído');
  });

  it('Principal (slug nulo) casa pelo schema', () => {
    const p = problemasPorCliente(atencao([{ schema: 'public', name: 'LM', slug: null, severity: 'amarelo',
      problems: [{ kind: 'aviso_nao_chega', severity: 'amarelo', people: 2 }] }]));
    expect(p.get('public')).toBeDefined();
  });
});
