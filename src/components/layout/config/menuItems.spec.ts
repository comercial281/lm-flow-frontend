import { describe, it, expect } from 'vitest';
import {
  getCustomerMenuItems, shouldShowMenuItem, MENU_FREE_BY_DESIGN, AUTOMATION_SECTOR_PERMISSIONS,
  type MenuItem, type SubMenuItem,
} from './menuItems';
import { ROUTE_PERMISSIONS, permissionForPath, hrefFor } from '@/routes/permissionRoutes';

const itens = getCustomerMenuItems((k: string) => k);
const todos: (MenuItem | SubMenuItem)[] = itens
  .flatMap(i => [i as MenuItem | SubMenuItem, ...(i.subItems ?? [])])
  .filter(i => i.href !== '#');
const achar = (href: string) => todos.find(i => i.href === href)!;
const semCargo = (i: MenuItem | SubMenuItem) => !(i.resource && i.action) && !(i.permissions && i.permissions.length > 0);

describe('o menu do CRM confere o cargo', () => {
  it('todo item declara a permissão que o servidor exige (ou é livre por decisão registrada)', () => {
    const faltando = todos.filter(i => semCargo(i) && !MENU_FREE_BY_DESIGN.includes(i.href)).map(i => i.href);
    expect(faltando).toEqual([]);
  });

  it.each([
    ['/disparos', 'broadcasts.read'],
    ['/ia-vendedora', 'sales_agents.read'],
    ['/properties', 'properties.read'],
    ['/books', 'properties.read'],
    ['/settings/portals', 'portals.read'],
    ['/visits', 'visits.read'],
    ['/proposals', 'proposals.read'],
    ['/contracts', 'contracts.read'],
    ['/property-capture-requests', 'property_capture_requests.read'],
    ['/property-interests', 'property_interests.read'],
    ['/automations/message-funnels', 'message_funnels.read'],
    ['/settings/pixel-capi', 'capi_configs.read'],
    ['/settings/site-builder', 'sites.read'],
  ])('%s pede %s', (href, chave) => {
    const item = achar(href);
    expect(`${item.resource}.${item.action}`).toBe(chave);
  });

  it('Automações aparece para quem tem qualquer um dos setores', () => {
    expect(achar('/automations').permissions).toEqual(Object.values(AUTOMATION_SECTOR_PERMISSIONS));
  });

  it('Tutoriais é o único livre', () => {
    expect([...MENU_FREE_BY_DESIGN]).toEqual(['/tutorials']);
  });

  it('o Corretor não vê IA Vendedora mesmo com a função liberada no cliente', () => {
    const can = (r: string, a: string) => `${r}.${a}` !== 'sales_agents.read';
    expect(shouldShowMenuItem(achar('/ia-vendedora'), can, () => false, () => false, 'agent', 'c@x.com',
      { client_manage_automations: true }, [], false)).toBe(false);
  });

  it('o suporte vem do parâmetro, não do e-mail', () => {
    const ia = achar('/ia-vendedora');
    const pode = () => true;
    expect(shouldShowMenuItem(ia, pode, pode, pode, 'admin', 'freela@gmail.com', {}, [], true)).toBe(true);
    expect(shouldShowMenuItem(ia, pode, pode, pode, 'admin', 'comercial@lealmidia.com.br', {}, [], false)).toBe(false);
  });

  // Ruling do controlador (fonte única de chave): todo item cujo href está em
  // ROUTE_PERMISSIONS (o mapa da B4) declara EXATAMENTE a chave daquele mapa —
  // nunca uma segunda cópia digitada aqui que possa divergir dele com o tempo.
  it('todo item com resource/action cujo href está no mapa de rotas usa a MESMA chave do mapa', () => {
    const divergentes = todos
      .filter(i => i.resource && i.action)
      .map(i => ({ href: i.href, item: `${i.resource}.${i.action}`, mapa: permissionForPath(i.href) }))
      .filter(({ mapa, item }) => mapa && `${mapa.resource}.${mapa.action}` !== item);
    expect(divergentes).toEqual([]);
  });

  // E o inverso, para os setores de Automações: cada chave de
  // AUTOMATION_SECTOR_PERMISSIONS é a mesma que o mapa de rotas exige para
  // /automations/<setor>, quando aquele setor tem rota protegida no mapa.
  it('AUTOMATION_SECTOR_PERMISSIONS bate com o mapa de rotas para /automations/<setor>', () => {
    const divergentes = Object.entries(AUTOMATION_SECTOR_PERMISSIONS)
      .map(([key, chave]) => {
        const entry = ROUTE_PERMISSIONS.find(r => r.automationsChild && hrefFor(r) === `/automations/${key}`);
        return { key, chave, mapa: entry ? `${entry.resource}.${entry.action}` : undefined };
      })
      .filter(({ mapa, chave }) => mapa && mapa !== chave);
    expect(divergentes).toEqual([]);
  });
});
