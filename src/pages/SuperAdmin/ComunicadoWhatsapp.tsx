// src/pages/SuperAdmin/ComunicadoWhatsapp.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { Button, Checkbox, Textarea } from '@/components/ui/ds';
import Abas from '@/components/base/Abas';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { plural, telefone } from '@/lib/formato';
import { CORPO_SECAO, ESQUELETO, PAGINA, SECAO, SUBTITULO_SECAO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';
import numberOwnershipService, { type PlatformNumber } from '@/services/superAdmin/numberOwnershipService';
import { textoDaSituacao } from './NumberOwnership/situacao';
import {
  comunicadoService,
  type ComunicadoAlvo,
  type ComunicadoAndamento,
  type ComunicadoModo,
} from '@/services/superAdmin/comunicadoService';
import {
  CLASSE_DO_ITEM,
  ESPERA_NOVA_LEITURA_MS,
  INTERVALO_ANDAMENTO_MS,
  LEITURAS_ANTES_DO_ERRO,
  ROTULO_DO_ITEM,
  pedidoDeEnvio,
  personalizar,
  textoDoAndamento,
} from './comunicadoRegras';

/**
 * Comunicação → WhatsApp: o Comunicado da Leal Mídia para os clientes (06/10).
 *
 * Tela própria (saiu a janela roxa antiga). Dois destinos,
 * escolhidos na hora: Donos (o telefone do dono de cada cliente) ou Grupos (o
 * grupo oficial, pela mesma regra do Kit de boas-vindas, lida pelo servidor).
 * Todos os clientes com destino vêm marcados (decisão antiga); quem não tem
 * aparece com o motivo e fica de fora.
 *
 * A confirmação diz o N que sai de fato, e o servidor confere esse N (recusa se
 * a lista mudou). O envio roda no servidor, um cliente por vez; a tela só
 * acompanha. Fechar a tela não para nada, e ao voltar ela retoma o envio em
 * andamento.
 */
const ABAS = [
  { chave: 'owners', rotulo: 'Donos' },
  { chave: 'groups', rotulo: 'Grupos' },
];

// "Fica de fora" é decidido pelo motivo, não pelo destino: o servidor pode mandar
// destino junto de um motivo (ex.: "Mesmo destino de X").
const podeReceber = (a: ComunicadoAlvo) => !!a.destination && !a.reason;

function erroDaApi(e: unknown): { status?: number; error?: string; id?: string } {
  const r = (e as { response?: { status?: number; data?: { error?: string; id?: string } } })?.response;
  return { status: r?.status, error: r?.data?.error, id: r?.data?.id };
}

export default function ComunicadoWhatsapp() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [modo, setModo] = useState<ComunicadoModo>('owners');
  const [numero, setNumero] = useState('');
  const [numeros, setNumeros] = useState<PlatformNumber[]>([]);
  const [carregandoNumeros, setCarregandoNumeros] = useState(true);
  const [erroNumeros, setErroNumeros] = useState(false);
  const [textoDoErro, setTextoDoErro] = useState('');
  const [alvos, setAlvos] = useState<ComunicadoAlvo[] | null>(null);
  const [semLeitura, setSemLeitura] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [acompanhando, setAcompanhando] = useState<string | null>(null);
  const [andamento, setAndamento] = useState<ComunicadoAndamento | null>(null);
  const [erroAndamento, setErroAndamento] = useState<null | 'falha' | 'naoachei'>(null);
  const [avisoNovos, setAvisoNovos] = useState(0);
  const [tentativa, setTentativa] = useState(0);

  // Só vale a resposta da última leitura (troca rápida de aba ou de número).
  const leitura = useRef(0);
  const envioEmCurso = useRef(false);
  // Sempre o modo/número de AGORA (o envio guarda os do clique).
  const modoAgora = useRef<ComunicadoModo>('owners');
  const numeroAgora = useRef('');
  const alvosAgora = useRef<ComunicadoAlvo[] | null>(null);

  const carregar = useCallback(async (m: ComunicadoModo, n?: string, manter?: { marcados: Set<string>; ids: Set<string> }) => {
    const minha = ++leitura.current;
    setCarregando(true);
    setErro(false);
    setTextoDoErro('');
    // A lista velha sai já: o N do envio nunca vem de outra aba ou de outro número.
    setAlvos(null);
    setSemLeitura(false);
    setMarcados(new Set());
    setAvisoNovos(0);
    try {
      const r = await comunicadoService.alvos(m, n);
      if (minha !== leitura.current) return;
      setNumero(r.instance);
      setSemLeitura(r.unreadable);
      setAlvos(r.targets);
      const aptos = r.targets.filter(podeReceber);
      if (manter) {
        // Depois de "A lista mudou": fica só quem estava marcado e ainda pode receber;
        // cliente que não estava na lista entra desmarcado.
        setMarcados(new Set(aptos.filter(a => manter.marcados.has(a.tenant_id)).map(a => a.tenant_id)));
        setAvisoNovos(aptos.filter(a => !manter.ids.has(a.tenant_id)).length);
      } else {
        setMarcados(new Set(aptos.map(a => a.tenant_id)));
      }
      if (r.running_id) setAcompanhando(r.running_id);
    } catch (e) {
      if (minha !== leitura.current) return;
      setAlvos(null);
      // O servidor recusa número que não é da Leal Mídia (422): mostra o texto dele.
      const r = erroDaApi(e);
      setTextoDoErro(r.status === 422 && r.error ? r.error : '');
      setErro(true);
    } finally {
      if (minha === leitura.current) setCarregando(false);
    }
  }, []);

  // Só números da Leal Mídia: o aviso nunca sai do número de um cliente. Ilegível ou
  // falha = seletor vazio com erro (nunca uma lista que parece completa).
  const leituraNumeros = useRef(0);
  const carregarNumeros = useCallback(async () => {
    const minha = ++leituraNumeros.current;
    setCarregandoNumeros(true);
    setErroNumeros(false);
    try {
      const r = await numberOwnershipService.platformNumbers();
      if (minha !== leituraNumeros.current) return;
      const dados = r.data?.data;
      if (!dados || dados.unreadable) {
        setNumeros([]);
        setErroNumeros(true);
      } else {
        setNumeros(dados.numbers ?? []);
      }
    } catch {
      if (minha !== leituraNumeros.current) return;
      setNumeros([]);
      setErroNumeros(true);
    } finally {
      if (minha === leituraNumeros.current) setCarregandoNumeros(false);
    }
  }, []);

  useEffect(() => {
    void carregar('owners');
    void carregarNumeros();
  }, [carregar, carregarNumeros]);

  // Acompanha o envio até o fim. Se a tela sumir, o envio segue no servidor.
  useEffect(() => {
    if (!acompanhando) return undefined;
    let vivo = true;
    let espera: ReturnType<typeof setTimeout> | undefined;
    let falhas = 0;
    const ler = async () => {
      try {
        const a = await comunicadoService.andamento(acompanhando);
        if (!vivo) return;
        falhas = 0;
        setAndamento(a);
        setErroAndamento(null);
        if (a.state === 'running') espera = setTimeout(() => void ler(), INTERVALO_ANDAMENTO_MS);
      } catch (e) {
        if (!vivo) return;
        if (erroDaApi(e).status === 404) {
          setErroAndamento('naoachei');
          return;
        }
        falhas += 1;
        if (falhas < LEITURAS_ANTES_DO_ERRO) espera = setTimeout(() => void ler(), ESPERA_NOVA_LEITURA_MS);
        else setErroAndamento('falha');
      }
    };
    void ler();
    return () => {
      vivo = false;
      if (espera) clearTimeout(espera);
    };
  }, [acompanhando, tentativa]);

  modoAgora.current = modo;
  alvosAgora.current = alvos;

  // O número padrão do servidor só vale se está entre os da Leal Mídia.
  const numeroValido = numeros.some(i => i.name === numero) ? numero : '';
  numeroAgora.current = numeroValido;

  const enviaveis = useMemo(() => (alvos ?? []).filter(podeReceber), [alvos]);
  const escolhidos = enviaveis.filter(a => marcados.has(a.tenant_id));
  const n = escolhidos.length;
  // Acompanhando um envio que ainda não foi lido também conta como rodando.
  const rodando = !!acompanhando && (!andamento || andamento.state === 'running') && !erroAndamento;

  const motivoTravado = (() => {
    if (rodando) return 'Espere o envio em andamento terminar.';
    if (carregando) return 'Espere a lista de clientes carregar.';
    if (carregandoNumeros) return 'Espere a lista de números carregar.';
    if (erroNumeros) return 'Não consegui ler os números da Leal Mídia. Tente de novo.';
    if (erro || semLeitura) return 'Escolha outro número ou tente de novo.';
    if (n === 0) return 'Nenhum cliente marcado com destino.';
    if (!numeroValido) return 'Escolha o número que envia.';
    if (!mensagem.trim()) return 'Escreva a mensagem.';
    return '';
  })();

  const trocarModo = (chave: string) => {
    const m = chave as ComunicadoModo;
    if (m === modo || enviando) return;
    setModo(m);
    void carregar(m, numeroValido || undefined);
  };

  const trocarNumero = (novo: string) => {
    if (enviando) return;
    setNumero(novo);
    // O grupo de cada cliente depende do número que envia; o telefone do dono, não.
    if (modo === 'groups') void carregar('groups', novo);
  };

  const marcar = (id: string, sim: boolean) =>
    setMarcados(prev => {
      const proximo = new Set(prev);
      if (sim) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });

  const enviar = async () => {
    if (motivoTravado || enviando || envioEmCurso.current) return;
    envioEmCurso.current = true;
    // Foto do que foi confirmado: o N e os clientes saem do mesmo lugar.
    const ids = escolhidos.map(a => a.tenant_id);
    const antes = { marcados: new Set(ids), ids: new Set((alvosAgora.current ?? []).map(a => a.tenant_id)) };
    const quem = { mode: modo, instance: numeroValido, message: mensagem, tenant_ids: ids, expected: ids.length };
    setEnviando(true);
    try {
      // Segunda volta só quando o servidor pede a confirmação de novo.
      for (let volta = 0; volta < 2; volta += 1) {
        if (!(await confirmar(pedidoDeEnvio(modo, ids.length, numeroValido)))) return;
        try {
          const id = await comunicadoService.enviar(quem);
          setAndamento(null);
          setErroAndamento(null);
          setAcompanhando(id);
          setMensagem('');
          return;
        } catch (e) {
          const r = erroDaApi(e);
          if (r.status === 422 && r.error?.startsWith('Confirme o envio de novo')) {
            toast.error(r.error);
            continue;
          }
          toast.error(r.error || 'Não deu pra enviar. Tente de novo.');
          if (r.status === 409 && r.id) {
            setAndamento(null);
            setErroAndamento(null);
            setAcompanhando(r.id);
            setTentativa(t => t + 1); // mesmo id já acompanhado: força nova leitura
          }
          if (r.status === 422 && r.error?.startsWith('A lista mudou')) {
            void carregar(modoAgora.current, numeroAgora.current || undefined, antes);
          }
          return;
        }
      }
    } finally {
      envioEmCurso.current = false;
      setEnviando(false);
    }
  };

  const listaDeClientes = () => {
    if (carregando) return <div className={`${ESQUELETO} h-40`} />;
    if (erro) {
      return <EmptyState tipo="erro" {...(textoDoErro ? { description: textoDoErro } : {})} aoTentarDeNovo={() => void carregar(modo, numeroValido || undefined)} className="py-8" />;
    }
    if (semLeitura) {
      return (
        <EmptyState
          tipo="erro"
          title="Não consegui ler os grupos"
          description={`O número ${numero} não devolveu a lista de grupos. Confira se ele está conectado ou escolha outro número abaixo.`}
          aoTentarDeNovo={() => void carregar(modo, numeroValido || undefined)}
          className="py-8"
        />
      );
    }
    if (!alvos || alvos.length === 0) {
      return (
        <EmptyState
          title="Nenhum cliente ainda"
          description="Quando houver clientes, eles aparecem aqui para receber o comunicado."
          className="py-8"
        />
      );
    }
    return (
      <>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{`Marcados: ${n} de ${enviaveis.length}`}</span>
          <div className="flex gap-3">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => setMarcados(new Set(enviaveis.map(a => a.tenant_id)))}
            >
              Marcar todos
            </Button>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setMarcados(new Set())}>
              Nenhum
            </Button>
          </div>
        </div>
        {avisoNovos > 0 && (
          <p role="status" className="mb-2 text-sm text-muted-foreground">
            {`${plural(avisoNovos, 'cliente novo na lista ficou desmarcado', 'clientes novos na lista ficaram desmarcados')}.`}
          </p>
        )}
        <ul className="max-h-96 divide-y overflow-y-auto rounded-lg border">
          {alvos.map(a => {
            const id = `comunicado-alvo-${a.tenant_id}`;
            const destino = podeReceber(a)
              ? modo === 'owners'
                ? telefone(a.destination)
                : a.destination
              : `${a.reason ?? 'Sem destino'} · fica de fora`;
            return (
              <li key={a.tenant_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Checkbox
                  id={id}
                  aria-label={a.name}
                  checked={podeReceber(a) && marcados.has(a.tenant_id)}
                  disabled={!podeReceber(a)}
                  onCheckedChange={v => marcar(a.tenant_id, v === true)}
                />
                <label htmlFor={id} className="min-w-0 flex-1 truncate">
                  {a.name}
                </label>
                <span className="shrink-0 text-muted-foreground">{destino}</span>
              </li>
            );
          })}
        </ul>
      </>
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <div className={PAGINA}>
        <header>
          <h2 className="text-xl font-semibold">WhatsApp</h2>
          <p className={SUBTITULO_SECAO}>
            Comunicado da Leal Mídia para os clientes: no telefone do dono ou no grupo oficial de cada um.
            Todos vêm marcados; desmarque quem não deve receber.
          </p>
        </header>

        {acompanhando && (
          <section aria-labelledby="comunicado-envio" className={SECAO}>
            <h3 id="comunicado-envio" className={TITULO_SECAO}>Envio</h3>
            <div className={CORPO_SECAO}>
              {erroAndamento ? (
                <EmptyState
                  tipo="erro"
                  title="Não consegui ler o andamento"
                  description={
                    erroAndamento === 'naoachei'
                      ? 'Não achei esse envio (pode ter passado de 24 h).'
                      : 'O envio continua no servidor. Tente ler de novo.'
                  }
                  aoTentarDeNovo={() => setTentativa(t => t + 1)}
                  className="py-6"
                />
              ) : !andamento ? (
                <p className="text-sm text-muted-foreground">Lendo o andamento…</p>
              ) : (
                <>
                  <p role="status" className="text-sm font-medium">{textoDoAndamento(andamento)}</p>
                  {andamento.state === 'running' && (
                    <p className="mt-1 text-xs text-muted-foreground">Pode fechar esta tela: o envio continua no servidor.</p>
                  )}
                  {andamento.items.length > 0 && (
                    <ul className="mt-3 max-h-96 divide-y overflow-y-auto rounded-lg border">
                      {andamento.items.map(i => (
                        <li key={i.tenant_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                          <span>{i.name}</span>
                          <span className={CLASSE_DO_ITEM[i.status]}>
                            {`${ROTULO_DO_ITEM[i.status]}${i.detail ? `: ${i.detail}` : ''}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        <section aria-labelledby="comunicado-para-quem" className={SECAO}>
          <h3 id="comunicado-para-quem" className={TITULO_SECAO}>Para quem</h3>
          <div aria-disabled={enviando || undefined} className={enviando ? 'pointer-events-none opacity-60' : undefined}>
            <Abas rotulo="Para quem" abas={ABAS} ativa={modo} aoTrocar={trocarModo} className="mt-3" />
          </div>
          <div className={CORPO_SECAO}>{listaDeClientes()}</div>
        </section>

        {/* Sem aria-labelledby nestas duas seções: o nome delas é o mesmo do campo, e
            "Número que envia"/"Mensagem" passariam a nomear a seção e o campo. */}
        <section className={SECAO}>
          <h3 className={TITULO_SECAO}>Número que envia</h3>
          <p className={SUBTITULO_SECAO}>
            O número da Leal Mídia de onde sai o comunicado. Em Grupos, ele precisa estar nos grupos dos clientes.
          </p>
          <div className={CORPO_SECAO}>
            {erroNumeros ? (
              <EmptyState
                tipo="erro"
                title="Não consegui ler os números da Leal Mídia"
                aoTentarDeNovo={() => void carregarNumeros()}
                className="py-6"
              />
            ) : (
              <Seletor
                id="comunicado-numero"
                aria-label="Número que envia"
                value={numeroValido}
                disabled={enviando || carregandoNumeros}
                onChange={e => trocarNumero(e.target.value)}
                className="w-full max-w-sm"
              >
                {!numeroValido && <option value="">Escolha o número</option>}
                {numeros.map(i => (
                  <option key={i.name} value={i.name}>
                    {`${i.name} · ${textoDaSituacao(i.status, i.disconnected_at)}`}
                  </option>
                ))}
              </Seletor>
            )}
          </div>
        </section>

        <section className={SECAO}>
          <label htmlFor="comunicado-mensagem" className={`block ${TITULO_SECAO}`}>
            Mensagem
          </label>
          <p className={SUBTITULO_SECAO}>Use {'{nome}'} para o nome do cliente (o primeiro nome do cadastro).</p>
          <div className={CORPO_SECAO}>
            <Textarea
              id="comunicado-mensagem"
              rows={6}
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
              placeholder="Olá, {nome}! Novidade no seu CRM: …"
            />
            {escolhidos[0] && mensagem.trim() && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground">{`Prévia para ${escolhidos[0].name}`}</p>
                <p className="mt-1 whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-sm">
                  {personalizar(mensagem, escolhidos[0].name)}
                </p>
              </div>
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void enviar()} disabled={!!motivoTravado || enviando}>
            {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar
          </Button>
          {motivoTravado && <span className="text-xs text-muted-foreground">{motivoTravado}</span>}
        </div>
      </div>

      {dialogoDeConfirmacao}
    </div>
  );
}
