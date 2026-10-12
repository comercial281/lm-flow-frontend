import { describe, it, expect } from 'vitest';
import type { KnowledgeLesson, KnowledgeModule } from '@/hooks/useKnowledge';
import { trocarOrdem, agruparAulas, contarAulas, modulosVisiveis, podeAssistir, quemAssiste, soParaGestores } from './quemVe';

const mod = (id: string, audience?: 'all' | 'managers'): KnowledgeModule => ({
  id, course_id: 'c1', titulo: id, descricao: null, capa_url: null, tenant_slug: null, ordem: 0,
  access: 'free', lock_cta_type: 'none', lock_cta_label: null, lock_cta_value: null, lock_message: null,
  created_at: '', updated_at: '', ...(audience ? { audience } : {}),
});
const aula = (id: string, module_id: string, ordem: number, duracao_min: number | null = 5): KnowledgeLesson => ({
  id, module_id, titulo: id, descricao_md: '', video_url: '', video_provider: 'youtube', video_id: '',
  storage_path: null, capa_url: null, duracao_min, ordem, created_at: '', updated_at: '',
});

describe('quem assiste', () => {
  it('módulo sem audience (servidor velho) conta como Todos', () => {
    expect(quemAssiste({})).toBe('all');
    expect(quemAssiste({ audience: null })).toBe('all');
    expect(quemAssiste({ audience: 'qualquer' })).toBe('all');
    expect(quemAssiste({ audience: 'managers' })).toBe('managers');
  });

  it('corretor não assiste módulo de gestor; gestor e admin assistem', () => {
    const m = mod('g', 'managers');
    expect(podeAssistir(m, 'corretor')).toBe(false);
    expect(podeAssistir(m, 'gestor')).toBe(true);
    expect(podeAssistir(m, 'admin')).toBe(true);
    expect(podeAssistir(mod('t'), 'corretor')).toBe(true);
  });
});

describe('modulosVisiveis', () => {
  const mods = [mod('todos'), mod('gestor', 'managers'), mod('vazio')];
  const aulas = agruparAulas([aula('a1', 'todos', 1), aula('a2', 'gestor', 1)]);

  it('corretor: sem o de gestor e sem o vazio', () => {
    expect(modulosVisiveis(mods, aulas, 'corretor', true).map((m) => m.id)).toEqual(['todos']);
  });
  it('gestor: sem o vazio', () => {
    expect(modulosVisiveis(mods, aulas, 'gestor', true).map((m) => m.id)).toEqual(['todos', 'gestor']);
  });
  it('admin: todos, inclusive o vazio', () => {
    expect(modulosVisiveis(mods, aulas, 'admin', true).map((m) => m.id)).toEqual(['todos', 'gestor', 'vazio']);
  });
  it('aulas ainda carregando: não some com o vazio (evita piscar a tela vazia)', () => {
    expect(modulosVisiveis(mods, {}, 'corretor', false).map((m) => m.id)).toEqual(['todos', 'vazio']);
  });
});

describe('agruparAulas e contarAulas', () => {
  it('agrupa por módulo, na ordem', () => {
    const g = agruparAulas([aula('b', 'm', 2), aula('a', 'm', 1)]);
    expect(g.m.map((l) => l.id)).toEqual(['a', 'b']);
  });
  it('ordem empatada: desempata por created_at', () => {
    const x = { ...aula('x', 'm', 0), created_at: '2026-10-02' };
    const y = { ...aula('y', 'm', 0), created_at: '2026-10-01' };
    expect(agruparAulas([x, y]).m.map((l) => l.id)).toEqual(['y', 'x']);
  });
  it('trocarOrdem regrava o índice de todos que mudam (tudo 0: só regrava quem muda de posição)', () => {
    const lista = [aula('a', 'm', 0), aula('b', 'm', 0), aula('c', 'm', 0)];
    expect(trocarOrdem(lista, 1, -1)).toEqual([{ id: 'a', ordem: 1 }, { id: 'c', ordem: 2 }]);
    expect(trocarOrdem(lista, 2, 1)).toEqual([]);
  });
  it('conta total, feitas e minutos só dos módulos passados', () => {
    const aulas = agruparAulas([aula('a', 'x', 1, 6), aula('b', 'x', 2, null), aula('c', 'y', 1, 9)]);
    expect(contarAulas([mod('x')], aulas, { a: true })).toEqual({ total: 2, feitas: 1, minutos: 6 });
  });
});

describe('soParaGestores', () => {
  it('só quando todos os módulos são de gestor', () => {
    expect(soParaGestores([mod('a', 'managers'), mod('b', 'managers')])).toBe(true);
    expect(soParaGestores([mod('a', 'managers'), mod('b')])).toBe(false);
    expect(soParaGestores([])).toBe(false);
  });
});
