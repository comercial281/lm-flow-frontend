import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ClipboardList, Loader2, RefreshCw, Search } from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea,
} from '@/components/ui/ds';
import { EmptyState } from '@/components/base';
import NoAccessState from '@/components/permissions/NoAccessState';
import { isForbiddenError } from '@/services/core/forbidden';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import { extractError } from '@/utils/apiHelpers';
import { dinheiro, telefone, tempoDesde } from '@/lib/formato';
import {
  propertyCaptureRequestsService,
  type PropertyCaptureRequest,
} from '@/services/propertyCaptureRequests/propertyCaptureRequestsService';
import { PROPERTY_TYPE_LABELS, TRANSACTION_TYPE_LABELS } from '@/services/properties/propertiesService';

// ── NOVAS CAPTAÇÕES (Imóveis entrega 3, 03/10/2026) ─────────────────────────
// Pedidos do formulário "Anuncie seu imóvel" do site que ainda esperam decisão.
// Aprovar cria o proprietário e o rascunho do imóvel no servidor e abre o
// cadastro dele; recusar pede o motivo e tira o pedido da fila.

const MAX_FOTOS = 4;

function Cartao({ r, ocupado, podeAprovar, aoAprovar, aoRecusar }: {
  r: PropertyCaptureRequest;
  ocupado: boolean;
  podeAprovar: boolean;
  aoAprovar: () => void;
  aoRecusar: () => void;
}) {
  const endereco = r.address.full || [r.address.city, r.address.state].filter(Boolean).join('/');
  const tipo = PROPERTY_TYPE_LABELS[r.property_type] ?? r.property_type;
  const finalidade = TRANSACTION_TYPE_LABELS[r.transaction_type] ?? r.transaction_type;
  const medidas = [
    r.bedrooms ? `${r.bedrooms} quartos` : null,
    r.bathrooms ? `${r.bathrooms} banheiros` : null,
    r.parking_spaces ? `${r.parking_spaces} vagas` : null,
    r.useful_area_m2 ? `${r.useful_area_m2} m²` : null,
  ].filter(Boolean).join(' · ');
  const fotos = (r.photo_urls ?? []).slice(0, MAX_FOTOS);

  return (
    <article data-testid="cartao-captacao" className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{r.owner.name || 'Sem nome'}</h3>
          <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {r.owner.phone && <span>{telefone(r.owner.phone)}</span>}
            {r.owner.email && <span>{r.owner.email}</span>}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">chegou {tempoDesde(r.created_at)}</span>
      </div>

      <div className="space-y-1 text-sm">
        <p className="font-medium">{tipo} · {finalidade}</p>
        {endereco && <p className="text-muted-foreground">{endereco}</p>}
        {medidas && <p className="text-xs text-muted-foreground">{medidas}</p>}
        {r.expected_price ? <p className="font-medium">{dinheiro(r.expected_price)}</p> : null}
      </div>

      {fotos.length > 0 && (
        <div className="flex gap-2">
          {fotos.map((url, i) => (
            <img key={`${i}-${url}`} src={url} alt="" loading="lazy" className="h-16 w-16 rounded-md border object-cover" />
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={aoRecusar} disabled={ocupado}>
          Recusar
        </Button>
        {podeAprovar && (
          <Button size="sm" onClick={aoAprovar} disabled={ocupado}>
            Aprovar e cadastrar
          </Button>
        )}
      </div>
    </article>
  );
}

export default function NovasCaptacoes() {
  const navigate = useNavigate();
  const podeAprovar = useFeature('property_capture_approve');
  const [pedidos, setPedidos] = useState<PropertyCaptureRequest[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [semAcesso, setSemAcesso] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [agindo, setAgindo] = useState<string | null>(null);
  const [recusando, setRecusando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setSemAcesso(false);
    setFalhou(false);
    try {
      const res = await propertyCaptureRequestsService.list({ pending: 'true' });
      setPedidos(res.data);
    } catch (e) {
      setPedidos([]);
      if (isForbiddenError(e)) setSemAcesso(true); else setFalhou(true);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const aprovar = async (id: string) => {
    if (agindo) return;
    setAgindo(id);
    try {
      const { property_id } = await propertyCaptureRequestsService.approve(id);
      if (!property_id) {
        toast.error('O imóvel não foi criado. Tente de novo.');
        return;
      }
      toast.success('Proprietário e imóvel criados. Complete o cadastro.');
      navigate(`/properties/${property_id}/editar`);
    } catch (e) {
      toast.error(extractError(e).message || 'Não foi possível aprovar o pedido');
    } finally {
      setAgindo(null);
    }
  };

  const fecharRecusa = () => { setRecusando(null); setMotivo(''); };

  const recusar = async () => {
    if (!recusando || agindo) return;
    const id = recusando;
    setAgindo(id);
    try {
      await propertyCaptureRequestsService.reject(id, motivo.trim());
      setPedidos(antes => antes.filter(p => p.id !== id));
      fecharRecusa();
    } catch (e) {
      toast.error(extractError(e).message || 'Não foi possível recusar o pedido');
    } finally {
      setAgindo(null);
    }
  };

  const termo = busca.trim().toLowerCase();
  const visiveis = termo
    ? pedidos.filter(r => [r.owner.name, r.owner.phone, r.address.city, r.address.full]
        .some(v => v?.toLowerCase().includes(termo)))
    : pedidos;

  if (semAcesso) return <NoAccessState />;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar captação" placeholder="Buscar por proprietário, telefone ou cidade..."
            value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={carregando} className="gap-1.5">
          <RefreshCw className="h-4 w-4" />Atualizar
        </Button>
      </div>
      {carregando ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando...
        </div>
      ) : falhou ? (
        <EmptyState tipo="erro" aoTentarDeNovo={() => void carregar()} />
      ) : pedidos.length > 0 && visiveis.length === 0 ? (
        <EmptyState tipo="semResultado" aoLimparFiltros={() => setBusca('')} />
      ) : pedidos.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma captação nova"
          description="Quando alguém preencher o formulário 'Anuncie seu imóvel' do seu site, o pedido aparece aqui."
        />
      ) : (
        visiveis.map(r => (
          <Cartao
            key={r.id}
            r={r}
            ocupado={agindo !== null}
            podeAprovar={podeAprovar}
            aoAprovar={() => void aprovar(r.id)}
            aoRecusar={() => setRecusando(r.id)}
          />
        ))
      )}

      <Dialog open={recusando !== null} onOpenChange={o => { if (!o && !agindo) fecharRecusa(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar pedido</DialogTitle>
            <DialogDescription>O pedido sai da fila de novas captações.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="motivo-recusa">Motivo</Label>
            <Textarea id="motivo-recusa" rows={3} placeholder="Informe o motivo..." value={motivo}
              onChange={e => setMotivo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharRecusa} disabled={!!agindo}>Cancelar</Button>
            <Button variant="destructive" onClick={() => void recusar()} disabled={!motivo.trim() || !!agindo}>
              Recusar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
