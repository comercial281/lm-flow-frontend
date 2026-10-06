import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import { CampoTexto } from '@/components/base/Campo';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { cvcrmService, type CvcrmStatus } from '@/services/cvcrm/cvcrmService';

// Integrações → CVCRM (06/10/2026). A conexão do cliente com o CVCRM dele: UMA por
// cliente, usada por todas as IAs que mandam o lead pro CVCRM (IA → Objetivo →
// Pra onde vai o lead → Sistema do cliente → CVCRM).
//
// ⚠️ O token entra e nunca volta (o servidor só diz se tem). Conectar TESTA antes
// de gravar: o resultado é a lista de empreendimentos do CVCRM deles.
// ⚠️ Esta tela mora em Settings/Integrations porque precisa dizer "token" (é o nome
// que o CVCRM usa na tela dele): fora das telas de conexão a palavra é proibida.

const PASSO_A_PASSO = [
  'No CVCRM, entre em Painel do Gestor → Usuários e escolha o usuário que vai cadastrar os leads.',
  'Gere um token para ele. Esse usuário precisa da permissão "Leads > Cadastrar/Alterar Lead" e de poder ver os empreendimentos.',
  'Cole aqui o endereço do CVCRM (o que aparece no navegador), o e-mail desse usuário e o token.',
];

// O subdomínio do que foi colado (mesma leitura do servidor, só pra avisar).
function subdominioDe(colado: string): string {
  return colado.trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/)[0]
    .replace(/:\d+$/, '').replace(/\.cvcrm\.com\.br$/, '');
}

export default function CvcrmConexao() {
  const [status, setStatus] = useState<CvcrmStatus | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [endereco, setEndereco] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [conectando, setConectando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  useEffect(() => {
    let vivo = true;
    cvcrmService.get()
      .then((s) => {
        if (!vivo) return;
        setStatus(s);
        setEndereco(s.subdomain ? `${s.subdomain}.cvcrm.com.br` : '');
        setEmail(s.email ?? '');
      })
      .catch((e) => { if (vivo) toast.error(apiErrorMessage(e, 'Não consegui abrir a conexão com o CVCRM.')); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  const conectar = async () => {
    setConectando(true);
    setResultado(null);
    try {
      const novo = await cvcrmService.connect({ subdomain: endereco.trim(), email: email.trim(), token: token.trim() });
      setStatus(novo);
      setToken('');
      setEditando(false);
      const n = novo.empreendimentos_count;
      setResultado({ ok: true, texto: `Conectado · ${n} ${n === 1 ? 'empreendimento encontrado' : 'empreendimentos encontrados'}` });
    } catch (e) {
      setResultado({ ok: false, texto: apiErrorMessage(e, 'Não consegui conectar o CVCRM agora.') });
    } finally {
      setConectando(false);
    }
  };

  const desconectar = async () => {
    const ok = await confirmar({
      titulo: 'Desconectar o CVCRM',
      descricao: 'As IAs que mandam lead pro CVCRM param de enviar e avisam a gestão a cada lead.',
      rotuloDaAcao: 'Desconectar',
      destrutivo: true,
    });
    if (!ok) return;
    try {
      setStatus(await cvcrmService.disconnect());
      setResultado(null);
      toast.success('CVCRM desconectado');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui desconectar agora.'));
    }
  };

  if (carregando) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  const conectado = status?.connected === true;
  const mostrarCampos = !conectado || editando;
  const podeConectar = endereco.trim() && email.trim() && token.trim() && !conectando;
  const usadaPor = status?.agents_using ?? 0;
  // Trocar de CVCRM com IAs usando: os números de empreendimento e fila gravados
  // nelas são do CVCRM antigo.
  const outroCvcrm = conectado && editando && usadaPor > 0 && Boolean(endereco.trim())
    && subdominioDe(endereco) !== status?.subdomain;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header>
        <h1 className="text-lg font-semibold text-foreground">CVCRM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte o CVCRM deste cliente para a IA cadastrar o lead direto nele, no empreendimento e na fila que você escolher na IA.
        </p>
      </header>

      <Secoes>
        <Secao
          titulo="Conexão"
          descricao={conectado
            ? `Conectado ao CVCRM ${status?.subdomain}.cvcrm.com.br. ${usadaPor === 0 ? 'Nenhuma IA usa ainda.' : `Usada por ${usadaPor} ${usadaPor === 1 ? 'IA' : 'IAs'}.`}`
            : 'Uma conexão vale para todas as IAs deste cliente.'}
        >
          {status?.token_state === 'unreadable' && (
            <p className="text-sm text-destructive">O token guardado não abre mais. Gere outro no CVCRM e conecte de novo.</p>
          )}

          {conectado && !editando && (
            <div className="space-y-3">
              <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
                <dt className="text-muted-foreground">Endereço</dt>
                <dd>{status?.subdomain}.cvcrm.com.br</dd>
                <dt className="text-muted-foreground">E-mail do usuário</dt>
                <dd>{status?.email}</dd>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => { setEditando(true); setResultado(null); }}>Trocar token</Button>
                <Button type="button" variant="ghost" onClick={desconectar}>Desconectar</Button>
              </div>
            </div>
          )}

          {mostrarCampos && (
            <div className="space-y-5">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                {PASSO_A_PASSO.map((p) => <li key={p}>{p}</li>)}
              </ol>
              <CampoTexto id="cvcrm-endereco" rotulo="Endereço do seu CVCRM" valor={endereco} aoMudar={setEndereco}
                placeholder="suaempresa.cvcrm.com.br" autoComplete="off"
                aviso={outroCvcrm ? 'Esse é outro CVCRM. Depois de conectar, confira o empreendimento e a fila em cada IA que usa a conexão.' : undefined} />
              <CampoTexto id="cvcrm-email" rotulo="E-mail do usuário" valor={email} aoMudar={setEmail} type="email"
                autoComplete="off" />
              <CampoTexto id="cvcrm-token" rotulo="Token" valor={token} aoMudar={setToken} type="password" autoComplete="new-password"
                ajuda={conectado ? 'Por segurança o token atual não aparece. Cole o novo.' : undefined} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={conectar} disabled={!podeConectar}>
                  {conectando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Conectar
                </Button>
                {editando && (
                  <Button type="button" variant="ghost" onClick={() => { setEditando(false); setToken(''); setResultado(null); }}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}

          {resultado && (
            <div
              role="status"
              className={`rounded-md border p-3 text-sm ${resultado.ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20' : 'border-red-300 bg-red-50 dark:bg-red-900/20'}`}
            >
              {resultado.texto}
            </div>
          )}
        </Secao>
      </Secoes>
      {dialogoDeConfirmacao}
    </div>
  );
}
