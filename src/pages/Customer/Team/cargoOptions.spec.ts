import { describe, it, expect } from 'vitest';
import { buildCargoOptions, cargoPayload, isCargoSelected } from './cargoOptions';
import type { CustomRole } from '@/types/customRoles';

/* A regressão que estes testes existem para impedir: a tabela de cargos nasce
   VAZIA em cada cliente (schema clonado do Principal sem dados). Quando a tela
   passou a listar só o que vem do banco, o seletor de cargo ficou vazio e
   ninguém conseguia definir cargo de ninguém. */

const role = (over: Partial<CustomRole>): CustomRole => ({
  id: 1,
  name: 'Cargo',
  slug: 'cargo',
  description: '',
  color: 'blue',
  permissions: [],
  effective_permissions: [],
  system: false,
  users_count: 0,
  ...over,
} as CustomRole);

describe('buildCargoOptions', () => {
  it('oferece os três de fábrica mesmo com o banco de cargos vazio', () => {
    const options = buildCargoOptions([]);

    expect(options.map(o => o.label)).toEqual(['Administrador', 'Gerente', 'Corretor']);
    // Sem cargo gravado, a gravação vai pelo caminho legado.
    expect(options.every(o => o.customRoleId == null && o.chaveRole)).toBe(true);
  });

  it('prefere o cargo gravado quando ele existe, para respeitar edição do cliente', () => {
    const options = buildCargoOptions([
      role({ id: 7, name: 'Corretor Sênior', slug: 'corretor', system: true }),
    ]);

    const corretor = options.find(o => o.chaveRole === 'agent');
    expect(corretor?.label).toBe('Corretor Sênior');
    expect(corretor?.customRoleId).toBe(7);
  });

  it('acrescenta os cargos próprios depois dos de fábrica', () => {
    const options = buildCargoOptions([role({ id: 9, name: 'SDR', slug: 'sdr' })]);

    expect(options).toHaveLength(4);
    expect(options[3]).toMatchObject({ label: 'SDR', customRoleId: 9 });
  });

  it('só marca Administrador como quem alcança tudo', () => {
    const options = buildCargoOptions([role({ id: 9, name: 'SDR', slug: 'sdr' })]);

    expect(options.filter(o => o.seesAllInboxes).map(o => o.label)).toEqual(['Administrador']);
  });
});

describe('cargoPayload', () => {
  it('manda o cargo gravado quando ele existe', () => {
    const [admin] = buildCargoOptions([role({ id: 3, name: 'Administrador', slug: 'administrador', system: true })]);
    expect(cargoPayload(admin)).toEqual({ custom_role_id: 3 });
  });

  it('cai no cargo legado quando o cliente não tem cargos gravados', () => {
    const [admin] = buildCargoOptions([]);
    expect(cargoPayload(admin)).toEqual({ chave_role: 'admin' });
  });
});

describe('isCargoSelected', () => {
  it('reconhece a pessoa pelo cargo legado quando não há cargo gravado', () => {
    const options = buildCargoOptions([]);
    const gerente = options.find(o => o.chaveRole === 'manager')!;

    expect(isCargoSelected(gerente, { custom_role_id: null, chave_role: 'manager' })).toBe(true);
    expect(isCargoSelected(gerente, { custom_role_id: null, chave_role: 'agent' })).toBe(false);
  });

  it('reconhece pelo cargo gravado quando a pessoa tem um', () => {
    const options = buildCargoOptions([role({ id: 9, name: 'SDR', slug: 'sdr' })]);
    const sdr = options.find(o => o.label === 'SDR')!;

    expect(isCargoSelected(sdr, { custom_role_id: 9, chave_role: 'agent' })).toBe(true);
    // Corretor de fábrica não pode aparecer marcado só porque o enum é 'agent'.
    const corretor = options.find(o => o.chaveRole === 'agent')!;
    expect(isCargoSelected(corretor, { custom_role_id: 9, chave_role: 'agent' })).toBe(false);
  });
});
