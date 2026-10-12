import { useMemo } from 'react';
import { toast } from 'sonner';
import { Copy, ExternalLink, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import Aviso from '@/components/base/Aviso';
import { dataHora, plural } from '@/lib/formato';
import type { PortalDetail } from '@/services/portals/portalsService';

function CopyRow({ label, value, href, hrefLabel = 'Abrir' }: {
  label: string;
  value: string;
  /** Quando presente, um botão que abre o endereço em outra aba, ao lado de Copiar. */
  href?: string;
  hrefLabel?: string;
}) {
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  };
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs">{value}</code>
        <Button variant="outline" size="sm" onClick={copy}>
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copiar
        </Button>
        {href && (
          <Button variant="outline" size="sm" asChild>
            <a href={href} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {hrefLabel}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

interface Props {
  portal: PortalDetail;
  aoRotacionar: () => void;
  aoDesconectar: () => void;
  desconectando: boolean;
}

/**
 * Aba *Conexão* do portal (redesenho de 12/10/2026): o que se configura uma vez
 * e quase nunca mais — os endereços pra colar no painel do portal, o passo a
 * passo, o histórico de leituras, a chave e o Desconectar (que saiu do topo).
 */
export default function PortalConexao({ portal, aoRotacionar, aoDesconectar, desconectando }: Props) {
  const leituras = useMemo(
    () => [...(portal.feed_access_log ?? [])].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [portal.feed_access_log],
  );

  return (
    <Secoes>
      <Secao
        titulo="Endereços"
        descricao="Cole no painel do portal. O do feed leva a lista dos seus imóveis; o de recebimento traz os leads pro funil."
      >
        {portal.feed_url && (
          <CopyRow label="Endereço do feed de imóveis" value={portal.feed_url} href={portal.feed_url} hrefLabel="Abrir feed" />
        )}
        {portal.lead_webhook_url && (
          <CopyRow label="Endereço de recebimento de leads" value={portal.lead_webhook_url} />
        )}
        {portal.capabilities.includes('email_leads') && (
          <Aviso tom="info" icone={Mail} compacto>
            Este portal também envia leads por e-mail. O e-mail de captação de leads do LM Flow está em implantação.
          </Aviso>
        )}
      </Secao>

      <Secao titulo="Como ativar" descricao="O passo a passo no painel do portal.">
        <ol className="ml-4 list-decimal space-y-2 text-sm text-muted-foreground">
          {portal.onboarding.map((passo, i) => <li key={i}>{passo}</li>)}
        </ol>
        {portal.integration_status === 'adapted' && (
          <Aviso tom="atencao" titulo="Formato a confirmar." compacto>
            {portal.status_note ?? 'Confirme com o portal antes do primeiro envio.'}
          </Aviso>
        )}
      </Secao>

      <Secao
        titulo="Histórico de leituras"
        descricao={leituras.length > 0
          ? `${plural(leituras.length, 'leitura', 'leituras')} · última em ${dataHora(leituras[0].at)}`
          : 'Cada vez que o portal baixa o feed aparece aqui.'}
      >
        {leituras.length === 0 ? (
          <p className="text-sm text-muted-foreground">O portal ainda não baixou o feed.</p>
        ) : (
          <ul className="max-h-72 divide-y divide-border overflow-y-auto text-sm" aria-label="Leituras do feed">
            {leituras.map((entrada, i) => (
              <li key={`${entrada.at}-${i}`} className="flex items-center justify-between py-2">
                <span>{dataHora(entrada.at)}</span>
                <span className="text-muted-foreground">{plural(entrada.listings, 'imóvel', 'imóveis')}</span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao
        titulo="Chave do feed"
        descricao="Rotacionar troca os dois endereços acima. Use se um deles vazou; depois, atualize no painel do portal."
      >
        <div>
          <Button variant="outline" onClick={aoRotacionar}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Rotacionar chave
          </Button>
        </div>
      </Secao>

      <Secao
        titulo="Desconectar"
        descricao="O portal deixa de receber seus imóveis: o endereço do feed para de responder. A configuração e o plano ficam guardados."
      >
        <div>
          <Button variant="outline" onClick={aoDesconectar} disabled={desconectando}>
            {desconectando ? 'Desconectando…' : `Desconectar ${portal.name}`}
          </Button>
        </div>
      </Secao>
    </Secoes>
  );
}
