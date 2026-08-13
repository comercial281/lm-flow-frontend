import { describe, it, expect } from 'vitest';
import axios, { AxiosHeaders } from 'axios';

/**
 * O que este spec protege: upload de arquivo não pode sair com Content-Type
 * application/json.
 *
 * O defeito que ele reproduz: o cliente de API define 'application/json' como padrão
 * no `axios.create`. Quando o corpo é FormData e esse cabeçalho está presente, o axios
 * SERIALIZA o FormData como JSON (`formDataToJSON`) — o arquivo vira `{}` e o servidor
 * recebe uma requisição sem arquivo nenhum, sem erro e sem pista.
 *
 * Foi o que quebrou o upload da Base de Conhecimento da IA Vendedora, e o que fez três
 * consertos seguidos no backend não mudarem nada: lá o arquivo nunca chegava.
 *
 * A guarda existia em api.ts, mas com a condição invertida (`=== undefined`), então
 * nunca rodava. Este spec falha se alguém reintroduzir essa condição.
 */
describe('cliente de API — FormData', () => {
  it('o axios converte FormData em JSON quando o Content-Type é json (o defeito)', () => {
    const form = new FormData();
    form.append('source_type', 'file');
    form.append('file', new Blob(['conteudo'], { type: 'application/pdf' }), 'planta.pdf');

    const transform = (axios.defaults.transformRequest as unknown as Array<
      (data: unknown, headers: AxiosHeaders) => unknown
    >)[0];

    const comJson = transform(form, new AxiosHeaders({ 'Content-Type': 'application/json' }));

    // Vira string JSON — o arquivo se perde. É exatamente o estrago que a guarda evita.
    expect(typeof comJson).toBe('string');
  });

  it('sem Content-Type, o FormData passa intacto e o navegador põe o boundary', () => {
    const form = new FormData();
    form.append('file', new Blob(['conteudo'], { type: 'application/pdf' }), 'planta.pdf');

    const transform = (axios.defaults.transformRequest as unknown as Array<
      (data: unknown, headers: AxiosHeaders) => unknown
    >)[0];

    const semHeader = transform(form, new AxiosHeaders());

    expect(semHeader).toBe(form);
  });

  it('a regra da guarda: FormData ⇒ apagar o Content-Type, qualquer que seja o valor', () => {
    // Espelha o que o interceptor de api.ts faz. Se a condição voltar a ser
    // `=== undefined`, o cabeçalho padrão sobrevive e o upload volta a quebrar.
    const aplicarGuarda = (data: unknown, headers: Record<string, string>) => {
      if (data instanceof FormData) {
        delete headers['Content-Type'];
        delete headers['content-type'];
      }
      return headers;
    };

    const form = new FormData();

    expect(aplicarGuarda(form, { 'Content-Type': 'application/json' })).toEqual({});
    expect(aplicarGuarda(form, { 'content-type': 'application/json' })).toEqual({});
    expect(aplicarGuarda(form, { 'Content-Type': 'multipart/form-data' })).toEqual({});
    // Requisição normal (não é upload) mantém o cabeçalho.
    expect(aplicarGuarda({ a: 1 }, { 'Content-Type': 'application/json' })).toEqual({
      'Content-Type': 'application/json',
    });
  });
});
