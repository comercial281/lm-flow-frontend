import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error módulo .mjs sem tipos
import { textosDaTela, botoesSemNome, tagsJsx, textosDoJson, noEscopo, contaSelectNativo, emTitleCase, SEM_ACENTO, TERMOS_TECNICOS } from './conferir-padrao.mjs';

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

  it('atributo hint= e text= é texto de tela', () => {
    expect(textos(`const x = <Campo hint="Instância que envia os avisos" />;`)).toEqual(['Instância que envia os avisos']);
    expect(textos(`const x = <Aviso text="Escolha a tag" />;`)).toEqual(['Escolha a tag']);
  });

  it('as palavras de plural(n, singular, plural) são texto de tela; o número não', () => {
    expect(textos(`const x = <p>{plural(total, 'instância', 'instâncias')}</p>;`)).toEqual(['instância', 'instâncias']);
    expect(textos(`const y = formato.plural(total, 'estágio', 'estágios');`)).toEqual(['estágio', 'estágios']);
    expect(textos(`const z = plural('três' as unknown as number, 'item', 'itens');`)).toEqual(['item', 'itens']);
  });

  it('a mensagem de reserva de apiErrorMessage(erro, texto) é texto de tela; o erro não', () => {
    expect(textos(`const m = apiErrorMessage(e, 'Não foi possível salvar a tag');`)).toEqual([
      'Não foi possível salvar a tag',
    ]);
    expect(textos(`const m = apiErrorMessage('payload do erro', 'Falhou');`)).toEqual(['Falhou']);
  });

  it('.ts é lido como TypeScript puro: genérico e asserção de tipo não viram texto de tela', () => {
    const codigo = `
      function f(): Envelope<Resposta> { return x as Envelope<Resposta>; }
      const y = <Envelope<T>>z;
    `;
    expect(textosDaTela(codigo, 'servico.ts')).toEqual([]);
  });

  it('.tsx continua lendo JSX normalmente', () => {
    expect(textos(`const x = <div>Olá</div>;`)).toEqual(['Olá']);
    expect(textosDaTela(`const x = <div>Olá</div>;`, 'Tela.tsx').map((t: { texto: string }) => t.texto)).toEqual(['Olá']);
  });
});

describe('TERMOS_TECNICOS: "instance" em inglês', () => {
  const instancia = TERMOS_TECNICOS.find(([nome]: [string, RegExp]) => nome === 'instance')?.[1] as RegExp;

  it('existe e pega "Instance ID", mas não "instanceof" nem identificador composto', () => {
    expect(instancia).toBeInstanceOf(RegExp);
    expect(instancia.test('Instance ID')).toBe(true);
    expect(instancia.test('instanceof')).toBe(false);
    expect(instancia.test('getInstance')).toBe(false);
    expect(instancia.test('BlockInstance')).toBe(false);
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

  it('acha "conversao"/"conversoes" sem acento', () => {
    expect(SEM_ACENTO.test('Funil visual com conversao em tempo real')).toBe(true);
    expect(SEM_ACENTO.test('Suas conversoes')).toBe(true);
    expect(SEM_ACENTO.test('Funil visual com conversão em tempo real')).toBe(false);
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

describe('contaSelectNativo: a lista nativa vale para o app inteiro', () => {
  it('conta o painel raiz, a landing, a sobra e o primeiro acesso', () => {
    expect(contaSelectNativo('src/pages/SuperAdmin/LeadsFeed/index.tsx')).toBe(true);
    expect(contaSelectNativo('src/pages/Admin/Area/Overview.tsx')).toBe(true);
    expect(contaSelectNativo('src/features/landing/editor/BlockConfigPanel.tsx')).toBe(true);
    expect(contaSelectNativo('src/components/agents/providerConfigs/DifyConfigForm.tsx')).toBe(true);
    expect(contaSelectNativo('src/pages/Setup/OnboardingPage.tsx')).toBe(true);
    expect(contaSelectNativo('src/pages/Customer/Settings/Account/AccountSettings.tsx')).toBe(true);
  });

  it('não conta as peças da casa, o widget, o portal público e os testes', () => {
    expect(contaSelectNativo('src/components/base/Seletor.tsx')).toBe(false);
    expect(contaSelectNativo('src/components/base/SeletorComAbas.tsx')).toBe(false);
    expect(contaSelectNativo('src/components/widget/PreChatForm.tsx')).toBe(false);
    expect(contaSelectNativo('src/pages/Public/portalShared.tsx')).toBe(false);
    expect(contaSelectNativo('src/pages/SuperAdmin/LeadsFeed/index.spec.tsx')).toBe(false);
    expect(contaSelectNativo('src/components/base/seletorOpcoes.ts')).toBe(false);
  });
});

describe('tagsJsx', () => {
  it('lista as tags JSX com a linha', () => {
    const tags = tagsJsx('const a = (\n<div>\n<h1>{x}</h1>\n<BaseHeader title="t" />\n</div>);', 'x.tsx');
    expect(tags).toEqual([
      { tag: 'div', linha: 2 },
      { tag: 'h1', linha: 3 },
      { tag: 'BaseHeader', linha: 4 },
    ]);
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
    // lista nativa conta na tela do cliente; comentário JSX e o próprio Seletor não
    writeFileSync(
      join(raiz, 'src/pages/Customer/Lista.tsx'),
      `export const L = () => (
        <div>
          {/* <select> antigo */}
          <select value="a"><option value="a">Ana</option></select>
          <NativeSelect value="b"><option value="b">Bia</option></NativeSelect>
          /** Id do <select> de dentro...
          {/*
          menu"). Um <select> mostra uma linha só, fechado. */}
        </div>
      );`,
    );
    mkdirSync(join(raiz, 'src/components/base'), { recursive: true });
    writeFileSync(join(raiz, 'src/components/base/Seletor.tsx'), 'const s = <select />;');
    // Padrão de telas: título e barra à mão, cabeçalho fora da moldura.
    writeFileSync(
      join(raiz, 'src/components/base/BaseHeader.tsx'),
      `export default function BaseHeader({ title }) {
        return <div><div style={{ background: 'linear-gradient(to bottom, #7c3aed, #9333ea)' }} /><h1>{title}</h1></div>;
      }`,
    );
    mkdirSync(join(raiz, 'src/components/coisas'), { recursive: true });
    writeFileSync(join(raiz, 'src/components/coisas/CoisasHeader.tsx'), 'export const CoisasHeader = () => <BaseHeader title={nome} />;');
    writeFileSync(
      join(raiz, 'src/pages/Customer/TituloAMao.tsx'),
      `export const T = () => (
        <div>
          <div style={{ background: 'linear-gradient(to bottom, #7c3aed, #9333ea)' }} />
          <h1>{nome}</h1>
        </div>
      );`,
    );
    writeFileSync(join(raiz, 'src/pages/Customer/ComMoldura.tsx'), 'export const C = () => <Pagina cabecalho={<CoisasHeader />} />;');
    writeFileSync(join(raiz, 'src/pages/Customer/SemMoldura.tsx'), 'export const S = () => <div><CoisasHeader /></div>;');
    writeFileSync(join(raiz, 'src/pages/Customer/DiretoSemMoldura.tsx'), 'export const D = () => <BaseHeader title={nome} />;');
    // A lista nativa conta no app inteiro: painel raiz e sobra contam; o widget,
    // o portal público e os testes, não.
    writeFileSync(join(raiz, 'src/pages/SuperAdmin/Filtro.tsx'), 'const f = <select value="x"><option value="x">Todos</option></select>;');
    mkdirSync(join(raiz, 'src/components/agents'), { recursive: true });
    writeFileSync(join(raiz, 'src/components/agents/Herdado.tsx'), 'const h = <select value="x" />;');
    mkdirSync(join(raiz, 'src/components/widget'), { recursive: true });
    writeFileSync(join(raiz, 'src/components/widget/PreChatForm.tsx'), 'const w = <select value="x" />;');
    mkdirSync(join(raiz, 'src/pages/Public'), { recursive: true });
    writeFileSync(join(raiz, 'src/pages/Public/portalShared.tsx'), 'const p = <select value="x" />;');
    writeFileSync(join(raiz, 'src/pages/Customer/Lista.spec.tsx'), 'const t = <select value="x" />;');
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
    expect(contagem(saida, 'tituloAMao')).toBe(1); // TituloAMao.tsx (o do BaseHeader não conta)
    expect(contagem(saida, 'barraAMao')).toBe(1); // TituloAMao.tsx (a do BaseHeader não conta)
    expect(contagem(saida, 'foraDaMoldura')).toBe(2); // SemMoldura + DiretoSemMoldura (wrapper e ComMoldura não contam)
    // <select> e <NativeSelect> de Lista.tsx + painel raiz (Filtro.tsx) + sobra (Herdado.tsx)
    expect(contagem(saida, 'selectNativo')).toBe(4);
  });

  it('PASSA no teto exato e REPROVA um abaixo', () => {
    const exato = { tecnico: 1, glossario: 1, plural: 1, acento: 1, maiusculas: 1, formato: 1, chaveMao: 1, iconeSemNome: 1, selectNativo: 4, tituloAMao: 1, barraAMao: 1, foraDaMoldura: 2 };
    expect(rodar(['--tetos', tetos(exato)]).codigo).toBe(0);
    const { saida, codigo } = rodar(['--tetos', tetos({ ...exato, glossario: 0 })]);
    expect(codigo).toBe(1);
    expect(saida).toContain('palavra fora do glossário: 1, e o teto é 0');
  });

  it('--listar mostra onde', () => {
    expect(rodar(['--listar', 'glossario']).saida).toContain('src/pages/Customer/Tela.tsx:3');
  });

  it('--listar selectNativo mostra o painel raiz e não mostra o widget nem o portal', () => {
    const { saida } = rodar(['--listar', 'selectNativo']);
    expect(saida).toContain('src/pages/SuperAdmin/Filtro.tsx:1');
    expect(saida).toContain('src/components/agents/Herdado.tsx:1');
    expect(saida).not.toContain('PreChatForm.tsx');
    expect(saida).not.toContain('portalShared.tsx');
    expect(saida).not.toContain('Lista.spec.tsx');
  });
});
