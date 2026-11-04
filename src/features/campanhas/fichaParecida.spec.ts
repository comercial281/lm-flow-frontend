import { describe, expect, it } from 'vitest';
import type { LeadAdsFormConfig } from '@/services/leadAds/leadAdsFormsService';
import { fichaParecida } from './fichaParecida';

const f = (form_name: string, extra: Partial<LeadAdsFormConfig> = {}): LeadAdsFormConfig => ({
  id: form_name, form_id: `id-${form_name}`, form_name, meta_page_id: null, page_name: null, pipeline_id: 'p', pipeline_stage_id: 's',
  label_ids: [], default_assignee_id: null, roleta_config_id: null, property_id: null, match_keyword: null, after_hours_message: null,
  is_active: true, created_at: '2026-10-01T00:00:00Z', ...extra,
});

describe('fichaParecida', () => {
  it('"[03/11] [CASTELO 2.0]" acha "[06/10] [CASTELO]"', () => {
    const castelo = f('[06/10] [CASTELO]');
    expect(fichaParecida('[03/11] [CASTELO 2.0]', [f('[01/10] [OUTRO]'), castelo])).toBe(castelo);
  });

  it('entre duas parecidas vence a de updated_at mais recente', () => {
    const velha = f('[01/09] [CASTELO]', { updated_at: '2026-09-01T00:00:00Z' });
    const nova = f('[06/10] [CASTELO]', { updated_at: '2026-10-20T00:00:00Z' });
    expect(fichaParecida('[03/11] [CASTELO 2.0]', [velha, nova])).toBe(nova);
    expect(fichaParecida('[03/11] [CASTELO 2.0]', [nova, velha])).toBe(nova);
  });

  it('ficha desligada só entra se não houver ligada', () => {
    const desligada = f('[06/10] [CASTELO]', { is_active: false, updated_at: '2026-10-30T00:00:00Z' });
    const ligada = f('[01/09] [CASTELO]', { updated_at: '2026-09-01T00:00:00Z' });
    expect(fichaParecida('[03/11] [CASTELO 2.0]', [desligada, ligada])).toBe(ligada);
    expect(fichaParecida('[03/11] [CASTELO 2.0]', [desligada])).toBe(desligada);
  });

  it('palavras genéricas sozinhas não sugerem nada', () => {
    expect(fichaParecida('[+ INT] [COND]', [f('[06/10] [+ INT] [COND]'), f('[01/10] [NOVO] [COPY]')])).toBeNull();
  });

  it('as genéricas não contam, mas a palavra útil casa', () => {
    const c = f('[06/10] [CASTELO] [COND]');
    expect(fichaParecida('[03/11] [CASTELO] [+ INT]', [c])).toBe(c);
  });

  it('nome sem palavra útil devolve null', () => {
    expect(fichaParecida('[03/11]', [f('[06/10] [CASTELO]')])).toBeNull();
    expect(fichaParecida('', [f('[06/10] [CASTELO]')])).toBeNull();
  });

  it('acento não atrapalha', () => {
    const c = f('[06/10] [CANAÃ]');
    expect(fichaParecida('[03/11] [CANAA]', [c])).toBe(c);
  });

  it('sem nenhuma palavra em comum devolve null', () => {
    expect(fichaParecida('[03/11] [VIVANT]', [f('[06/10] [CASTELO]')])).toBeNull();
  });

  it('palavra de 1-2 letras, preposição e "vila" em comum não sugerem nada', () => {
    expect(fichaParecida('[03/11] [Residencial da Praça]', [f('[06/10] [Edifício da Serra]')])).toBeNull();
    expect(fichaParecida('[03/11] [Parque do Sol]', [f('[06/10] [Jardim do Mar]')])).toBeNull();
    expect(fichaParecida('[03/11] [Vila Verde]', [f('[06/10] [Vila Madalena]')])).toBeNull();
    expect(fichaParecida('[03/11] [AB Castelo]', [f('[06/10] [AB Vivant]')])).toBeNull();
    expect(fichaParecida('[03/11] [Casa de Pedra]', [f('[06/10] [Torre de Vidro]')])).toBeNull();
  });

  it('com uma palavra útil em comum, a preposição não atrapalha', () => {
    const c = f('[06/10] [Vila Castelo]');
    expect(fichaParecida('[03/11] [Parque do Castelo]', [c])).toBe(c);
  });
});
