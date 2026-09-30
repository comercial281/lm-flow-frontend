import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error módulo .mjs sem tipos
import { textosDaTela, botoesSemNome, textosDoJson, noEscopo, emTitleCase, SEM_ACENTO } from './conferir-padrao.mjs';

// A catraca da Fase 3 precisa ser vista REPROVANDO, não só passando — mesma
// lição do conferir-caixinhas.spec. E o que ela considera "texto de tela"
// precisa estar escrito em teste: é a fronteira entre "pipeline" em código
// (fica) e "Pipeline" na tela (sai).

const SCRIPT = join(__dirname, 'conferir-padrao.mjs');

describe('textosDaTela: o que conta como texto que aparece', () => {
  const textos = (codigo: string) => textosDaTela(codigo).map((t: { texto: string }) => t.texto);

  it('pega texto entre tags, atributo de texto, toast, confirmação e mapa de rótulos', () => {
    const codigo = `
      const TRIGGER_LABELS = { manual: 'Manual do pipeline' };
      function Tela() {
        toast.error('Falha ao deletar');
        confirmar({ titulo: 'Apagar lembrete', rotuloDaAcao: 'Apagar' });
        return <div title="Tag nova"><p>Escolha a instância</p>{ok ? 'Ativo' : 'Pausado'}</div>;
      }`;
    expect(textos(codigo)).toEqual(
      expect.arrayContaining(['Manual do pipeline', 'Falha ao deletar', 'Apagar lembrete', 'Apagar', 'Tag nova', 'Escolha a instância', 'Ativo', 'Pausado']),
    );
  });

  it('NÃO pega código: nome de variável, rota, className, chave de tradução', () => {
    const codigo = `
      const pipelineId = 1;
      navigate('/pipelines');
      function Tela() { return <div className="pipeline-tag">{t('pipelines.title')}</div>; }`;
    expect(textos(codigo)).toEqual([]);
  });

  it('comparação e condição de ternário não são texto de tela', () => {
    // Discriminante de tipo ('label') não conta, nem a condição (tipo === ...)
    expect(textos(`function T() { return <div>{type === 'label' ? <A /> : <B />}</div>; }`)).toEqual([]);

    // Os ramos (Sim, Não) contam como texto
    expect(textos(`function T() { return <div>{modo === 'pipeline' ? 'Sim' : 'Não'}</div>; }`)).toEqual(
      expect.arrayContaining(['Sim', 'Não']),
    );

    // Operadores que passam texto (&&, ??, +) contam; concatenação trimma espaços
    expect(textos(`function T() { return <div>{ok && 'Pronto'}{nome ?? 'Sem nome'}{'Olá ' + nome}</div>; }`)).toEqual(
      expect.arrayContaining(['Pronto', 'Sem nome', 'Olá']),
    );
  });
});

describe('botoesSemNome', () => {
  const conta = (codigo: string) => botoesSemNome(codigo).length;

  it('acha botão que só tem ícone', () => {
    expect(conta('const x = <Button onClick={f}><Trash2 className="h-4 w-4" /></Button>;')).toBe(1);
    expect(conta('const x = <button>{busy ? <Loader2 /> : <Play />}</button>;')).toBe(1);
  });

  it('não acusa botão com nome, com texto em qualquer nível, ou com spread', () => {
    expect(conta('const x = <Button aria-label="Excluir"><Trash2 /></Button>;')).toBe(0);
    expect(conta('const x = <Button title="Editar"><Pencil /></Button>;')).toBe(0);
    expect(conta('const x = <Button><Plus /> Novo</Button>;')).toBe(0);
    expect(conta('const x = <button><div><GitBranch /></div><div>{nome}</div></button>;')).toBe(0);
    expect(conta('const x = <Button>{busy ? <><Loader2 />{t("a")}</> : <Play />}</Button>;')).toBe(0);
    expect(conta('const x = <Button><img src="a.png" alt="Atlassian" /></Button>;')).toBe(0);
    expect(conta('const x = <Button {...props}><X /></Button>;')).toBe(0);
  });
});

describe('textosDoJson', () => {
  it('lê os valores e tira as {{variáveis}}, que o i18next troca antes de aparecer', () => {
    const lidos = textosDoJson({ a: { b: 'Token {{token}} inválido', c: '{{count}}' } });
    expect(lidos).toEqual([{ linha: 'a.b', texto: 'Token   inválido' }]);
  });
});

describe('acento e maiúsculas', () => {
  it('acha palavra comum sem acento, mas não o pedaço de outra palavra', () => {
    expect(SEM_ACENTO.test('Salvar configuracoes')).toBe(true);
    expect(SEM_ACENTO.test('Clique no botao')).toBe(true);
    expect(SEM_ACENTO.test('Configurações')).toBe(false);
    expect(SEM_ACENTO.test('botaozinho')).toBe(false);
  });

  it('Title Case só em texto curto, descontando nome próprio', () => {
    expect(emTitleCase('Novo Cargo')).toBe(true);
    expect(emTitleCase('Enviar Convites Agora')).toBe(true);
    expect(emTitleCase('Novo cargo')).toBe(false);
    expect(emTitleCase('Conectar WhatsApp')).toBe(false); // uma palavra relevante só
    expect(emTitleCase('IA Vendedora')).toBe(false);
    expect(emTitleCase('Uma frase longa Com Várias Palavras Aqui Dentro')).toBe(false);
  });
});

describe('noEscopo: o que é tela do cliente', () => {
  it('fica fora o painel raiz, o público, a landing, a sobra e os testes', () => {
    expect(noEscopo('src/pages/Customer/Settings/Account/AccountSettings.tsx')).toBe(true);
    expect(noEscopo('src/pages/SuperAdmin/CustoIA.tsx')).toBe(false);
    expect(noEscopo('src/pages/Admin/Area/Overview.tsx')).toBe(false);
    expect(noEscopo('src/pages/Public/PortalHomePage.tsx')).toBe(false);
    expect(noEscopo('src/features/landing/blocks/render-types.ts')).toBe(false);
    expect(noEscopo('src/components/AccessTokens/AccessTokensTable.tsx')).toBe(false);
    expect(noEscopo('src/pages/Customer/Settings/Account/AccountSettings.spec.tsx')).toBe(false);
  });
});

describe('a catraca, de ponta a ponta, numa raiz de mentira', () => {
  let raiz: string;

  beforeAll(() => {
    raiz = mkdtempSync(join(tmpdir(), 'conferir-padrao-'));
    mkdirSync(join(raiz, 'src/pages/Customer'), { recursive: true });
    mkdirSync(join(raiz, 'src/pages/SuperAdmin'), { recursive: true });
    mkdirSync(join(raiz, 'src/i18n/locales/pt-BR'), { recursive: true });
    writeFileSync(
      join(raiz, 'src/pages/Customer/Tela.tsx'),
      `export default function Tela() {
        const v = (1.5).toLocaleString();
        return <div><p>Deletar {v} contato(s)</p><Button><Trash2 /></Button><span role="switch" /></div>;
      }`,
    );
    // no painel raiz, o mesmo texto NÃO conta
    writeFileSync(join(raiz, 'src/pages/SuperAdmin/Painel.tsx'), 'const x = <p>Deletar instância</p>;');
    writeFileSync(
      join(raiz, 'src/i18n/locales/pt-BR/common.json'),
      JSON.stringify({ a: 'Escolha a instância', b: 'Novo Cargo', c: 'Abrir configuracoes', d: 'https://site.com/usuario' }),
    );
    // namespace da sobra não conta
    writeFileSync(join(raiz, 'src/i18n/locales/pt-BR/telegram.json'), JSON.stringify({ a: 'Token do bot' }));
  });
  afterAll(() => rmSync(raiz, { recursive: true, force: true }));

  const rodar = (args: string[] = []) => {
    try {
      const saida = execFileSync('node', [SCRIPT, ...args], {
        encoding: 'utf8',
        env: { ...process.env, CONFERIR_PADRAO_RAIZ: raiz },
      });
      return { saida, codigo: 0 };
    } catch (e) {
      const erro = e as { stdout?: string; stderr?: string; status?: number };
      return { saida: (erro.stdout ?? '') + (erro.stderr ?? ''), codigo: erro.status ?? -1 };
    }
  };
  const contagem = (saida: string, categoria: string) => {
    const linha = saida.split('\n').find(l => l.trim().startsWith(categoria + ' '));
    if (!linha) throw new Error(`categoria ${categoria} não encontrada em:\n${saida}`);
    return Number(linha.trim().split(/\s+/)[1]);
  };
  const tetos = (valores: Record<string, number>) => {
    const arquivo = join(raiz, 'tetos.json');
    writeFileSync(arquivo, JSON.stringify(valores));
    return arquivo;
  };

  it('conta cada categoria só na tela do cliente', () => {
    const { saida, codigo } = rodar();
    expect(codigo).toBe(0);
    expect(contagem(saida, 'tecnico')).toBe(1); // "Escolha a instância" (common.json)
    expect(contagem(saida, 'glossario')).toBe(1); // "Deletar"
    expect(contagem(saida, 'plural')).toBe(1); // "contato(s)"
    expect(contagem(saida, 'formato')).toBe(1); // toLocaleString()
    expect(contagem(saida, 'acento')).toBe(1); // "configuracoes" (a URL não conta)
    expect(contagem(saida, 'maiusculas')).toBe(1); // "Novo Cargo"
    expect(contagem(saida, 'chaveMao')).toBe(1);
    expect(contagem(saida, 'iconeSemNome')).toBe(1);
  });

  it('PASSA no teto exato e REPROVA um abaixo', () => {
    const exato = { tecnico: 1, glossario: 1, plural: 1, acento: 1, maiusculas: 1, formato: 1, chaveMao: 1, iconeSemNome: 1 };
    expect(rodar(['--tetos', tetos(exato)]).codigo).toBe(0);
    const { saida, codigo } = rodar(['--tetos', tetos({ ...exato, glossario: 0 })]);
    expect(codigo).toBe(1);
    expect(saida).toContain('palavra fora do glossário: 1, e o teto é 0');
  });

  it('--listar mostra onde', () => {
    expect(rodar(['--listar', 'glossario']).saida).toContain('src/pages/Customer/Tela.tsx:3');
  });
});
