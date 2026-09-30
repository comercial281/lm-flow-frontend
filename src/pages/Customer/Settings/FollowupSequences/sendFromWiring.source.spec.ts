import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// Follow-up (fase 2b.2). A tela tem ~1.500 linhas e monta meia dúzia de
// serviços; montá-la num teste puxaria tudo. As regras moram em
// features/numbers (com spec); aqui se confere a ligação.
//
// O `(?!')` na remoção de comentário de bloco é necessário NESTE arquivo: ele
// tem `'audio/*'`, `'image/*'` e `'video/*'` (accept de upload) — sem a
// negativa, a regex ingênua trata a barra-asterisco dentro da string como
// abertura de comentário e engole ~500 linhas de código real até o próximo
// `*/`, fazendo o teste falhar por um motivo que não tem nada a ver com a
// fiação que ele testa.
const bruto = readFileSync(resolve(__dirname, 'FollowupSequences.tsx'), 'utf8');
const codigo = bruto.replace(/\/\*(?!')[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Follow-up → Enviar pelo número', () => {
  it('o campo aparece no editor do funil', () => {
    expect(codigo).toContain('<SendFromField');
    expect(codigo).toContain('scope="followup_sequences"');
    expect(codigo).toContain('onChange={v => setEditing({ ...editing, ...v })}');
  });

  it('a escolha vai no salvar, normalizada (vazio volta ao padrão)', () => {
    expect(codigo).toContain('...sendFromOf(editing),');
  });

  it('"um número específico" sem número não salva', () => {
    expect(codigo).toContain('sendFromProblem(sendFromOf(editing))');
  });

  it('o aviso do servidor aparece ao criar e ao editar', () => {
    expect(codigo).toContain('avisar(sendFromWarnings(created))');
    expect(codigo).toContain('avisar(sendFromWarnings(saved))');
  });

  it('funil novo nasce no padrão', () => {
    expect(codigo).toMatch(/send_from: '',\s*send_from_inbox_id: '',/);
  });
});

describe('Follow-up → {{corretor}} e o nome fixo (E38, E39)', () => {
  it('o chip "Corretor" insere {{corretor}}', () => {
    expect(codigo).toMatch(/label: 'Corretor',\s*token: '\{\{corretor\}\}'/);
  });

  it('cada passo avisa quando o texto tem o nome de alguém da equipe', () => {
    expect(codigo).toContain('const avisoNomeDoPasso = teamNameWarning(s.content, equipe);');
    expect(codigo).toContain('{avisoNomeDoPasso && <p className="text-xs text-amber-600 mt-1">{avisoNomeDoPasso}</p>}');
  });

  it('a equipe é carregada uma vez, e falha vira lista vazia (sem aviso)', () => {
    expect(codigo).toContain('usersService.getUsers()');
    expect(codigo).toContain('.catch(() => setEquipe([]))');
  });
});
