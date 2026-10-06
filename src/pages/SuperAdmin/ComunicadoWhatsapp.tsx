// src/pages/SuperAdmin/ComunicadoWhatsapp.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { Button, Checkbox, Textarea } from '@/components/ui/ds';
import Abas from '@/components/base/Abas';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { telefone } from '@/lib/formato';
import { CORPO_SECAO, ESQUELETO, PAGINA, SECAO, SUBTITULO_SECAO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';
import clientInstancesService, { type CentralInstance } from '@/services/clientInstances/clientInstancesService';
import {
  comunicadoService,
  type ComunicadoAlvo,
  type ComunicadoAndamento,
  type ComunicadoModo,
} from '@/services/superAdmin/comunicadoService';
import {
  CLASSE_DO_ITEM,
  INTERVALO_ANDAMENTO_MS,
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

function erroDaApi(e: unknown): { status?: number; error?: string; id?: string } {
  const r = (e as { response?: { status?: number; data?: { error?: string; id?: string } } })?.response;
  return { status: r?.status, error: r?.data?.error, id: r?.data?.id };
}

export default function ComunicadoWhatsapp() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [modo, setModo] = useState<ComunicadoModo>('owners');
  const [numero, setNumero] = useState('');
  const [numeros, setNumeros] = useState<CentralInstance[]>([]);
  const [alvos, setAlvos] = useState<ComunicadoAlvo[] | null>(null);
  const [semLeitura, setSemLeitura] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [acompanhando, setAcompanhando] = useState<string | null>(null);
  const [andamento, setAndamento] = useState<ComunicadoAndamento | null>(null);
  const [erroAndamento, setErroAndamento] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  // Só vale a resposta da última leitura (troca rápida de aba ou de número).
  const leitura = useRef(0);
  const envioEmCurso = useRef(false);

  const carregar = useCallback(async (m: ComunicadoModo, n?: string) => {
    const minha = ++leitura.current;
    setCarregando(true);
    setErro(false);
    // A lista velha sai já: o N do envio nunca vem de outra aba ou de outro número.
    setAlvos(null);
    setSemLeitura(false);
    setMarcados(new Set());
    try {
      const r = await comunicadoService.alvos(m, n);
      if (minha !== leitura.current) return;
      setNumero(r.instance);
      setSemLeitura(r.unreadable);
      setAlvos(r.targets);
      setMarcados(new Set(r.targets.filter(a => a.destination).map(a => a.tenant_id)));
      if (r.running_id) setAcompanhando(r.running_id);
    } catch {
      if (minha !== leitura.current) return;
      setAlvos(null);
      setErro(true);
    } finally {
      if (minha === leitura.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar('owners');
    // Falha da lista de números não derruba a tela: o seletor mostra o número em uso.
    clientInstancesService
      .centralInstances()
      .then(r => setNumeros(r.data?.data ?? []))
      .catch(() => setNumeros([]));
  }, [carregar]);

  // Acompanha o envio até o fim. Se a tela sumir, o envio segue no servidor.
  useEffect(() => {
    if (!acompanhando) return undefined;
    let vivo = true;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const ler = async () => {
      try {
        const a = await comunicadoService.andamento(acompanhando);
        if (!vivo) return;
        setAndamento(a);
        setErroAndamento(false);
        if (a.state === 'running') espera = setTimeout(() => void ler(), INTERVALO_ANDAMENTO_MS);
      } catch {
        if (vivo) setErroAndamento(true);
      }
    };
    void ler();
    return () => {
      vivo = false;
      if (espera) clearTimeout(espera);
    };
  }, [acompanhando, tentativa]);

  const enviaveis = useMemo(() => (alvos ?? []).filter(a => a.destination), [alvos]);
  const escolhidos = enviaveis.filter(a => marcados.has(a.tenant_id));
  const n = escolhidos.length;
  // Acompanhando um envio que ainda não foi lido também conta como rodando.
  const rodando = !!acompanhando && (!andamento || andamento.state === 'running') && !erroAndamento;

  const motivoTravado = (() => {
    if (rodando) return 'Espere o envio em andamento terminar.';
    if (carregando || erro || semLeitura) return 'Espere a lista de clientes carregar.';
    if (n === 0) return 'Nenhum cliente marcado com destino.';
    if (!numero) return 'Escolha o número que envia.';
    if (!mensagem.trim()) return 'Escreva a mensagem.';
    return '';
  })();

  const trocarModo = (chave: string) => {
    const m = chave as ComunicadoModo;
    if (m === modo) return;
    setModo(m);
    void carregar(m, numero || undefined);
  };

  const trocarNumero = (novo: string) => {
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
    const quem = { mode: modo, instance: numero, message: mensagem, tenant_ids: ids, expected: ids.length };
    setEnviando(true);
    try {
      // Segunda volta só quando o servidor pede a confirmação de novo.
      for (let volta = 0; volta < 2; volta += 1) {
        if (!(await confirmar(pedidoDeEnvio(modo, ids.length, numero)))) return;
        try {
          const id = await comunicadoService.enviar(quem);
          setAndamento(null);
          setErroAndamento(false);
          setAcompanhando(id);
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
            setErroAndamento(false);
            setAcompanhando(r.id);
          }
          if (r.status === 422 && r.error?.startsWith('A lista mudou')) {
            toast.error('Os destinos mudaram. Confira a lista e envie de novo.');
            void carregar(modo, numero);
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
      return <EmptyState tipo="erro" aoTentarDeNovo={() => void carregar(modo, numero || undefined)} className="py-8" />;
    }
    if (semLeitura) {
      return (
        <EmptyState
          tipo="erro"
          title="Não consegui ler os grupos"
          description={`O número ${numero} não devolveu a lista de grupos. Confira se ele está conectado ou escolha outro número abaixo.`}
          aoTentarDeNovo={() => void carregar(modo, numero)}
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
        <ul className="max-h-96 divide-y overflow-y-auto rounded-lg border">
          {alvos.map(a => {
            const id = `comunicado-alvo-${a.tenant_id}`;
            const destino = a.destination
              ? modo === 'owners'
                ? telefone(a.destination)
                : a.destination
              : `${a.reason ?? 'Sem destino'} · fica de fora`;
            return (
              <li key={a.tenant_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Checkbox
                  id={id}
                  aria-label={a.name}
                  checked={!!a.destination && marcados.has(a.tenant_id)}
                  disabled={!a.destination}
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
                  description="O envio continua no servidor. Tente ler de novo."
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
          <Abas rotulo="Para quem" abas={ABAS} ativa={modo} aoTrocar={trocarModo} className="mt-3" />
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
            <Seletor
              id="comunicado-numero"
              aria-label="Número que envia"
              value={numero}
              onChange={e => trocarNumero(e.target.value)}
              className="w-full max-w-sm"
            >
              {!numero && <option value="">Escolha o número</option>}
              {numero && !numeros.some(i => i.name === numero) && <option value={numero}>{numero}</option>}
              {numeros.map(i => (
                <option key={i.name} value={i.name}>
                  {i.name}
                  {i.connected ? '' : ' (desconectado)'}
                </option>
              ))}
            </Seletor>
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
