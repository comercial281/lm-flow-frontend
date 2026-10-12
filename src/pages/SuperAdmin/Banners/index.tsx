// Área do Admin → Comunicação → Banner (spec LM FLOW/specs/2026-10-12-banner-dashboard-design.md).
//
// Banner da Dashboard dos clientes: atualização ("Mensagens prontas agora na
// lateral") ou campanha da Leal Mídia. A arte é sempre subida aqui; o servidor
// recusa arte fora da medida e decide quem vê.
import { useCallback, useEffect, useState } from 'react';
import { CircleOff, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { BaseStatusBadge, BotaoMaisAcoes, EmptyState } from '@/components/base';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { dataHora } from '@/lib/formato';
import { dashboardBannersService as svc } from '@/services/superAdmin/dashboardBannersService';
import type { BannerAdmin, ImobiliariaDoBanner } from '@/types/admin/dashboardBanners';
import { ESQUELETO, PAGINA } from '@/pages/Admin/Area/estilo';
import EditorDoBanner from './EditorDoBanner';
import { NOME_DA_SITUACAO, numerosDoBanner } from './regras';

export default function Banners() {
  const [banners, setBanners] = useState<BannerAdmin[] | null>(null);
  const [imobiliarias, setImobiliarias] = useState<ImobiliariaDoBanner[]>([]);
  const [erro, setErro] = useState(false);
  const [editando, setEditando] = useState<{ banner: BannerAdmin | null } | null>(null);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const carregar = useCallback(async () => {
    setErro(false);
    try {
      const r = await svc.listar();
      setBanners(r.banners);
      setImobiliarias(r.imobiliarias);
    } catch { setErro(true); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const trocar = useCallback((b: BannerAdmin) => {
    setBanners((lista) => {
      const atual = lista ?? [];
      return atual.some((x) => x.id === b.id) ? atual.map((x) => (x.id === b.id ? b : x)) : [b, ...atual];
    });
  }, []);

  const tirarDoAr = async (b: BannerAdmin) => {
    const sim = await confirmar({
      titulo: `Tirar ${b.name} do ar?`,
      descricao: 'Ele some da Dashboard de todo mundo agora. Os números de quem viu ficam.',
      rotuloDaAcao: 'Tirar do ar',
    });
    if (!sim) return;
    try { trocar(await svc.tirarDoAr(b.id)); toast.success('Banner fora do ar.'); }
    catch { toast.error('Não deu pra tirar do ar.'); }
  };

  const excluir = async (b: BannerAdmin) => {
    const sim = await confirmar({
      titulo: `Excluir ${b.name}?`,
      descricao: 'O banner e os números dele somem de vez.',
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    });
    if (!sim) return;
    try {
      await svc.excluir(b.id);
      setBanners((lista) => (lista ?? []).filter((x) => x.id !== b.id));
      toast.success('Banner excluído.');
    } catch { toast.error('Não deu pra excluir.'); }
  };

  return (
    <div className={PAGINA}>
      <div className="flex flex-wrap items-start gap-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Banners que aparecem na Dashboard dos clientes: atualização do LM Flow ou campanha da Leal Mídia. Vários no
          ar passam em carrossel. Arte do computador em 2800 × 560 px e do celular em 1080 × 540 px.
        </p>
        <Button className="ml-auto" onClick={() => setEditando({ banner: null })}>Novo banner</Button>
      </div>

      {erro ? <EmptyState tipo="erro" title="Não deu para carregar os banners" aoTentarDeNovo={() => void carregar()} />
        : banners === null ? <div aria-busy="true" className={`h-40 ${ESQUELETO}`} />
        : banners.length === 0 ? (
          <EmptyState
            tipo="vazio"
            title="Ainda não tem banner"
            description="Avise a carteira de uma novidade direto na Dashboard."
            exemplo="Atualização nova: Mensagens prontas do lado da conversa"
            action={{ label: 'Novo banner', onClick: () => setEditando({ banner: null }) }}
          />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {banners.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-4 p-4">
                <button type="button" className="w-48 shrink-0 overflow-hidden rounded-md border"
                  onClick={() => setEditando({ banner: b })} aria-label={`Editar ${b.name}`}>
                  {b.desktop_url
                    ? <img src={b.desktop_url} alt="" className="aspect-[5/1] w-full object-cover" />
                    : <div className="grid aspect-[5/1] w-full place-items-center text-xs text-muted-foreground">Sem arte</div>}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{b.name}</p>
                    <BaseStatusBadge status={b.situation === 'live' ? 'active' : 'inactive'} text={NOME_DA_SITUACAO[b.situation]} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {b.starts_at ? `De ${dataHora(b.starts_at)} ` : ''}{b.ends_at ? `até ${dataHora(b.ends_at)}` : ''}
                  </p>
                  {b.status === 'published' && (
                    <p className="text-sm text-muted-foreground">{numerosDoBanner(b.seen_count, b.clicked_count)}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><BotaoMaisAcoes aria-label={`Opções de ${b.name}`} /></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditando({ banner: b })}><Pencil className="h-4 w-4" />Editar</DropdownMenuItem>
                    {(b.situation === 'live' || b.situation === 'scheduled') && (
                      <DropdownMenuItem onSelect={() => void tirarDoAr(b)}><CircleOff className="h-4 w-4" />Tirar do ar</DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => void excluir(b)}><Trash2 className="h-4 w-4" />Excluir</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}

      <EditorDoBanner
        aberto={editando !== null}
        banner={editando?.banner ?? null}
        imobiliarias={imobiliarias}
        aoMudar={trocar}
        aoFechar={() => setEditando(null)}
      />
      {dialogoDeConfirmacao}
    </div>
  );
}
