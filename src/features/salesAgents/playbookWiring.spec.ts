import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Duas cicatrizes desta tela que só aparecem em PRODUÇÃO, e caladas. Nenhuma das
// duas quebra tipo, teste de componente ou build — por isso este spec lê o
// código-fonte, que é onde elas moram.
//
// 1. O `saveAgent` monta o PATCH campo a campo. Campo fora daquela lista é
//    descartado sem erro: a tela mostra o valor, o aviso diz "Salvo", e nada foi
//    salvo. Já aconteceu com a curtida e com os dois campos do book do imóvel.
//
// 2. Os dois scanners do catálogo de funcionalidades varrem o código por REGEX.
//    Trocar a chave literal por uma constante tira a chave do catálogo no deploy
//    seguinte, o painel de Funções deixa de oferecer o botão de liberar, e
//    ninguém é avisado.
const read = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf8');

const TELA = 'src/pages/Customer/Automations/SalesAgents/SalesAgents.tsx';

describe('roteiro da IA na tela do cliente', () => {
  const src = read(TELA);

  it('o roteiro entra na lista campo-a-campo do PATCH', () => {
    const saveAgent = src.slice(src.indexOf('const saveAgent'), src.indexOf('const saveAgent') + 6000);

    expect(saveAgent).toContain('playbook:');
  });

  // Com `??`, limpar o roteiro inteiro (voltar tudo ao padrão de fábrica) seria
  // trocado de volta pelo valor antigo: a tela mostraria "no padrão", o aviso
  // diria "Salvo", e o servidor continuaria com o texto reescrito.
  it('e entra com `in`, não com `??` — objeto vazio é escolha legítima', () => {
    expect(src).toContain("playbook: 'playbook' in patch ? patch.playbook : selected.playbook");
  });

  it('a chave do gate vai LITERAL, para os scanners do catálogo a enxergarem', () => {
    expect(src).toContain("useClientToggle('ia_playbook')");
  });
});
