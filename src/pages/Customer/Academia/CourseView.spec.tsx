import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const m = vi.hoisted(() => ({ cargo: 'corretor' as 'admin' | 'gestor' | 'corretor', aulasDesligado: false, pronto: true }));
vi.mock('./useCargoNaAcademia', () => ({
  useCargoNaAcademia: () => ({ cargo: m.cargo, podeEditar: m.cargo === 'admin', ehLealMidia: m.cargo === 'admin', pronto: m.pronto }),
}));
const base = { tenant_slug: null, ordem: 0, access: 'free', lock_cta_type: 'none', lock_cta_label: null, lock_cta_value: null, lock_message: null, created_at: '', updated_at: '', descricao: null, capa_url: null };
const aula = (id: string, module_id: string, ordem: number) => ({ id, module_id, titulo: `Aula ${id}`, descricao_md: '', video_url: '', video_provider: 'youtube', video_id: 'x', storage_path: null, capa_url: null, duracao_min: 5, ordem, created_at: '', updated_at: '' });
vi.mock('@/hooks/useKnowledge', () => ({
  TENANT_SLUG: '',
  useCourses: () => ({ data: [{ ...base, id: 'c1', titulo: 'Como usar o LM Flow' }, { ...base, id: 'c2', titulo: 'Gestão do time' }] }),
  useModules: () => ({ data: [
    { ...base, id: 'm1', course_id: 'c1', titulo: 'Introdução', audience: 'all', ordem: 1 },
    { ...base, id: 'm2', course_id: 'c1', titulo: 'Para gestores', audience: 'managers', ordem: 2 },
    { ...base, id: 'm3', course_id: 'c2', titulo: 'Roleta', audience: 'managers', ordem: 1 },
  ], isLoading: false, error: null, refetch: vi.fn() }),
  useAllLessons: () => ({ data: m.aulasDesligado ? undefined : [aula('a1', 'm1', 1), aula('a2', 'm1', 2), aula('g1', 'm2', 1), aula('r1', 'm3', 1)], isLoading: false }),
  useProgress: () => ({ data: {} }),
  useToggleProgress: () => ({ mutate: vi.fn(), isPending: false }),
  useEntitlements: () => ({ data: [] }),
  useRatings: () => ({ data: undefined }),
  useSetRating: () => ({ mutate: vi.fn() }),
  useDeleteModule: () => ({ mutate: vi.fn() }),
  useUpdateModule: () => ({ mutateAsync: vi.fn() }),
  useDeleteLesson: () => ({ mutate: vi.fn() }),
  useUpdateLesson: () => ({ mutateAsync: vi.fn() }),
  computeLocked: () => false,
  getCurrentUserRef: () => 'x@x.com',
}));
vi.mock('@/pages/Customer/Tutorials/_internal/VideoEmbed', () => ({ default: () => <div>video</div> }));
vi.mock('@/pages/Customer/Tutorials/_internal/CommentsSection', () => ({ default: () => null }));
vi.mock('./LessonAttachments', () => ({ default: () => null }));

import CourseView from './CourseView';

const abrir = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/academia/curso/:courseId" element={<CourseView onBack={() => {}} />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => { m.cargo = 'corretor'; m.aulasDesligado = false; m.pronto = true; });

describe('CourseView', () => {
  it('corretor não vê o módulo de gestor na lista', () => {
    abrir('/academia/curso/c1');
    expect(screen.getAllByText('Introdução').length).toBeGreaterThan(0);
    expect(screen.queryByText('Para gestores')).toBeNull();
  });

  it('gestor vê o módulo com o selo Gestores', () => {
    m.cargo = 'gestor';
    abrir('/academia/curso/c1');
    expect(screen.getByText('Para gestores')).toBeTruthy();
    expect(screen.getAllByText('Gestores').length).toBeGreaterThan(0);
  });

  it('corretor com link de aula de gestor vê o aviso', () => {
    abrir('/academia/curso/c1?lesson=g1');
    expect(screen.getByText('Esta aula é só para gestores')).toBeTruthy();
  });

  it('corretor com link de curso só de gestor vê o aviso do curso', () => {
    abrir('/academia/curso/c2');
    expect(screen.getByText('Este curso é só para gestores')).toBeTruthy();
  });

  it('aulas ainda não buscadas: não decide "só para gestores" nem "Nenhuma aula"', () => {
    m.aulasDesligado = true;
    abrir('/academia/curso/c2');
    expect(screen.queryByText('Este curso é só para gestores')).toBeNull();
    expect(screen.queryByText('Nenhuma aula neste curso ainda.')).toBeNull();
  });

  it('permissões ainda carregando: não mostra o aviso de gestor', () => {
    m.pronto = false;
    abrir('/academia/curso/c1?lesson=g1');
    expect(screen.queryByText('Esta aula é só para gestores')).toBeNull();
    m.pronto = false;
    abrir('/academia/curso/c2');
    expect(screen.queryByText('Este curso é só para gestores')).toBeNull();
  });

  it('mostra a trilha e os botões de assistir', () => {
    abrir('/academia/curso/c1?lesson=a1');
    expect(screen.getByText('Aula 1 de 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Marcar como vista/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Próxima aula/ })).toBeTruthy();
  });
});
