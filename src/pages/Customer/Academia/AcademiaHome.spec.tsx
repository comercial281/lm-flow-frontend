import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const m = vi.hoisted(() => ({
  cargo: 'corretor' as 'admin' | 'gestor' | 'corretor',
  aulasCarregando: false,
  aulasDesligado: false,
}));

vi.mock('./useCargoNaAcademia', () => ({
  useCargoNaAcademia: () => ({ cargo: m.cargo, podeEditar: m.cargo === 'admin', ehLealMidia: m.cargo === 'admin', pronto: true }),
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel: (s: { currentUser: { name: string } }) => unknown) => sel({ currentUser: { name: 'Marina Souza' } }),
}));

const base = { tenant_slug: null, ordem: 0, access: 'free', lock_cta_type: 'none', lock_cta_label: null, lock_cta_value: null, lock_message: null, created_at: '', updated_at: '', descricao: null, capa_url: null };
const cursos = [
  { ...base, id: 'c1', titulo: 'Como usar o LM Flow', icone: null },
  { ...base, id: 'c2', titulo: 'Gestão do time', icone: null },
];
const modulos = [
  { ...base, id: 'm1', course_id: 'c1', titulo: 'Introdução', audience: 'all' },
  { ...base, id: 'm2', course_id: 'c1', titulo: 'Para gestores', audience: 'managers' },
  { ...base, id: 'm3', course_id: 'c2', titulo: 'Roleta', audience: 'managers' },
  { ...base, id: 'm4', course_id: null, titulo: 'Como vender pelo WhatsApp', audience: 'all' },
  { ...base, id: 'm5', course_id: null, titulo: 'Como fazer follow up', audience: 'all' },
];
const aula = (id: string, module_id: string) => ({ id, module_id, titulo: id, descricao_md: '', video_url: '', video_provider: 'youtube', video_id: '', storage_path: null, capa_url: null, duracao_min: 5, ordem: 1, created_at: '', updated_at: '' });
const aulas = [aula('a1', 'm1'), aula('a2', 'm2'), aula('a3', 'm3'), aula('a4', 'm4')];

vi.mock('@/hooks/useKnowledge', () => ({
  TENANT_SLUG: '',
  useCourses: () => ({ data: cursos, isLoading: false, error: null, refetch: vi.fn() }),
  useModules: () => ({ data: modulos, isLoading: false, error: null, refetch: vi.fn() }),
  useAllLessons: () => ({ data: m.aulasDesligado ? undefined : m.aulasCarregando ? [] : aulas, isLoading: m.aulasCarregando }),
  useProgress: () => ({ data: { a1: true } }),
  useEntitlements: () => ({ data: [] }),
  useDeleteCourse: () => ({ mutate: vi.fn() }),
  computeLocked: () => false,
  getCurrentUserRef: () => 'marina@x.com',
}));
vi.mock('./CourseForm', () => ({ default: () => null }));
vi.mock('./ModuleForm', () => ({ default: () => null }));

import AcademiaHome from './AcademiaHome';

const abrir = () => render(<MemoryRouter><AcademiaHome /></MemoryRouter>);

beforeEach(() => { m.cargo = 'corretor'; m.aulasCarregando = false; m.aulasDesligado = false; });

describe('AcademiaHome', () => {
  it('corretor: não vê curso nem módulo de gestor, nem módulo vazio; conta só as aulas dele', () => {
    abrir();
    expect(screen.getByRole('heading', { name: 'Olá, Marina' })).toBeTruthy();
    expect(screen.getByText('Como usar o LM Flow')).toBeTruthy();
    expect(screen.queryByText('Gestão do time')).toBeNull();
    expect(screen.queryByText('Como fazer follow up')).toBeNull();
    expect(screen.getByText('Aulas avulsas')).toBeTruthy();
    expect(screen.getByText('Como vender pelo WhatsApp')).toBeTruthy();
    expect(screen.getByText('1 de 2 aulas')).toBeTruthy();
    expect(screen.queryByText('Gestores')).toBeNull();
  });

  it('gestor: vê o curso de gestão com o selo Gestores', () => {
    m.cargo = 'gestor';
    abrir();
    expect(screen.getByText('Gestão do time')).toBeTruthy();
    expect(screen.getAllByText('Gestores').length).toBeGreaterThan(0);
    expect(screen.getByText('1 de 4 aulas')).toBeTruthy();
  });

  it('Leal Mídia: vê o módulo vazio com o aviso', () => {
    m.cargo = 'admin';
    abrir();
    expect(screen.getByText('Como fazer follow up')).toBeTruthy();
    expect(screen.getByText('Sem aulas ainda. Só a Leal Mídia vê este módulo.')).toBeTruthy();
  });

  it('aulas carregando: não mostra "Nenhum curso ainda."', () => {
    m.aulasCarregando = true;
    abrir();
    expect(screen.queryByText('Nenhum curso ainda.')).toBeNull();
    expect(screen.getByText('Como usar o LM Flow')).toBeTruthy();
  });

  it('aulas ainda não buscadas (data undefined): não pisca "Nenhum curso ainda." nem "Sem aulas ainda…" pro corretor', () => {
    m.aulasDesligado = true;
    abrir();
    expect(screen.queryByText('Nenhum curso ainda.')).toBeNull();
    expect(screen.queryByText(/Sem aulas ainda/)).toBeNull();
    expect(screen.getByText('Como vender pelo WhatsApp')).toBeTruthy();
  });

  it('embutida na aba Aulas: saudação sem título de página (o Tutorial já tem o dele)', () => {
    render(<MemoryRouter><AcademiaHome embedded /></MemoryRouter>);
    expect(screen.queryByRole('heading', { name: 'Olá, Marina' })).toBeNull();
    expect(screen.getByText('Olá, Marina')).toBeTruthy();
    expect(screen.getByText('1 de 2 aulas')).toBeTruthy();
  });
});
