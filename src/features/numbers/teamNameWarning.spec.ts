import { describe, it, expect } from 'vitest';
import { teamNameInText, teamNameWarning } from './teamNameWarning';

// Nome fixo no texto (fase 2b.2, E39): "Eu sou a Gabriela" sai igual para lead
// de QUALQUER corretor. A tela avisa (não barra) e sugere {{corretor}}.
const equipe = [{ name: 'Gabriela Souza' }, { name: 'Vitória Lima' }, { name: 'Ana' }, { name: 'Jo' }, { name: 'Nome Silva' }];

describe('teamNameInText', () => {
  it('acha o primeiro nome de alguém da equipe', () => {
    expect(teamNameInText('Eu sou a Gabriela, consultora da imobiliária.', equipe)).toBe('Gabriela');
  });

  it('ignora acento e caixa', () => {
    expect(teamNameInText('aqui é a VITORIA', equipe)).toBe('Vitória');
  });

  it('só palavra inteira: "Anabela" não é "Ana"', () => {
    expect(teamNameInText('Falo com a Anabela amanhã', equipe)).toBeNull();
  });

  it('o que está dentro de {{…}} não conta', () => {
    expect(teamNameInText('Oi {{nome}}, aqui é {{corretor}}', equipe)).toBeNull();
  });

  it('nome com menos de 3 letras não conta', () => {
    expect(teamNameInText('Oi, jo!', equipe)).toBeNull();
  });

  it('texto vazio ou equipe vazia: nada', () => {
    expect(teamNameInText('', equipe)).toBeNull();
    expect(teamNameInText(undefined, equipe)).toBeNull();
    expect(teamNameInText('Eu sou a Gabriela', [])).toBeNull();
  });
});

describe('teamNameWarning', () => {
  it('o aviso, com o nome encontrado', () => {
    expect(teamNameWarning('Eu sou a Gabriela', equipe)).toBe(
      'O texto cita "Gabriela", que é da equipe: todo lead recebe esse nome, seja de qual corretor for. ' +
      'Para sair o nome de quem atende o lead, use {{corretor}}.',
    );
  });

  it('sem nome da equipe: sem aviso', () => {
    expect(teamNameWarning('Oi {{nome}}, tudo bem?', equipe)).toBeNull();
  });
});
