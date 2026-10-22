import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { BaseHeader, EmptyState, Pagina } from '@/components/base';
import Abas from '@/components/base/Abas';
import Aviso from '@/components/base/Aviso';
import Carregando from '@/components/base/Carregando';
import { Badge, Button } from '@/components/ui/ds';
import MessageTemplateForm from '@/components/channels/settings/MessageTemplateForm';
import { useConexaoOficial } from '@/components/channels/forms/whatsapp/useConexaoOficial';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import InboxesService from '@/services/channels/inboxesService';
import WhatsappService from '@/services/channels/whatsappService';
import { data, telefone } from '@/lib/formato';
import type { Inbox } from '@/types/channels/inbox';

const painelDaMeta = (wabaId: string | null) =>
  `https://business.facebook.com/wa/manage/home/?waba_id=${encodeURIComponent(wabaId ?? '')}`;

export default function NumeroOficial() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const { can } = usePermissions();
  const podeEditar = can('inboxes', 'update');
  // Religar passa pela mesma rota de conectar, que o servidor libera só pra quem cria caixa.
  const podeReconectar = podeEditar && can('inboxes', 'create');

  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [carga, setCarga] = useState<'carregando' | 'ok' | 'erro' | 'naoOficial'>('carregando');
  const [desligando, setDesligando] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    setCarga('carregando');
    try {
      const resposta = await InboxesService.getById(id);
      const dados = resposta.data;
      if (!dados?.whatsapp_cloud) {
        setCarga('naoOficial');
        return;
      }
      setInbox(dados);
      setCarga('ok');
    } catch {
      setCarga('erro');
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const nuvem = inbox?.whatsapp_cloud ?? null;

  const reconexao = useConexaoOficial({
    inboxId: id,
    ativo: carga === 'ok',
    aoConectar: () => {
      toast.success('Número reconectado.');
      carregar();
    },
  });

  const desconectar = async () => {
    if (!id) return;
    const ok = await confirmar({
      titulo: 'Desconectar este número?',
      descricao: 'As conversas continuam aqui. Pra voltar a receber, é só Reconectar.',
      rotuloDaAcao: 'Desconectar',
      destrutivo: true,
    });
    if (!ok) return;
    setDesligando(true);
    try {
      await WhatsappService.disconnectCloud(id);
      toast.success('Número desconectado.');
      await carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Não deu pra desconectar agora. Tente de novo.');
    } finally {
      setDesligando(false);
    }
  };

  const voltar = (
    <button
      type="button"
      onClick={() => navigate('/channels')}
      className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4 mr-1" />
      Canais
    </button>
  );

  if (carga === 'carregando' && !inbox) {
    return (
      <Pagina acima={voltar} cabecalho={<BaseHeader title="Número oficial" />}>
        <Carregando variante="texto" linhas={4} rotulo="Carregando o número..." />
      </Pagina>
    );
  }

  if (carga === 'erro') {
    return (
      <Pagina acima={voltar} cabecalho={<BaseHeader title="Número oficial" />}>
        <EmptyState tipo="erro" aoTentarDeNovo={carregar} />
      </Pagina>
    );
  }

  if (carga === 'naoOficial' || !inbox || !nuvem) {
    return (
      <Pagina acima={voltar} cabecalho={<BaseHeader title="Número oficial" />}>
        <EmptyState
          title="Este canal não é um número da API oficial."
          action={{ label: 'Voltar aos Canais', onClick: () => navigate('/channels') }}
        />
      </Pagina>
    );
  }

  const nome = nuvem.verified_name || inbox.name;
  const numero = telefone(nuvem.display_phone_number || inbox.phone_number);

  return (
    <Pagina
      acima={voltar}
      cabecalho={
        <BaseHeader
          title={nome}
          aoLadoDoTitulo={<Badge variant="outline">API oficial</Badge>}
          subtitle={[
            numero,
            nuvem.verified_name ? `O lead vê o nome ${nuvem.verified_name}` : null,
            nuvem.connected && nuvem.connected_at ? `Conectado em ${data(nuvem.connected_at)}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          aDireita={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!nuvem.waba_id}
                onClick={() => window.open(painelDaMeta(nuvem.waba_id), '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Abrir no painel da Meta
              </Button>
              {podeReconectar && reconexao.liberado && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!reconexao.pronto || reconexao.carregando}
                  onClick={() => reconexao.iniciar(nuvem.mode)}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  {reconexao.carregando || !reconexao.pronto ? 'Carregando...' : 'Reconectar'}
                </Button>
              )}
              {podeEditar && nuvem.connected && (
                <Button variant="outline" size="sm" disabled={desligando} onClick={desconectar}>
                  Desconectar
                </Button>
              )}
            </div>
          }
        />
      }
    >
      <div className="space-y-4">
        {!nuvem.connected && (
          <Aviso tom="atencao">Este número não está recebendo mensagens. Reconecte pra voltar a atender.</Aviso>
        )}
        {podeReconectar && !reconexao.liberado && (
          <Aviso tom="info">A conexão com a API oficial ainda não está liberada neste LM Flow.</Aviso>
        )}
        {reconexao.erro && <Aviso tom="erro">{reconexao.erro}</Aviso>}
        <Abas
          rotulo="Gestão do número oficial"
          abas={[{ chave: 'modelos', rotulo: 'Modelos de mensagem' }]}
          ativa="modelos"
          aoTrocar={() => {}}
        />
        {/* Criar e apagar modelo exige editar a caixa: quem não pode só levaria erro. */}
        {podeEditar ? (
          <MessageTemplateForm inboxId={inbox.id} channelType={inbox.channel_type} />
        ) : (
          <Aviso tom="info">Os modelos são do gestor do número.</Aviso>
        )}
      </div>
      {dialogoDeConfirmacao}
    </Pagina>
  );
}
