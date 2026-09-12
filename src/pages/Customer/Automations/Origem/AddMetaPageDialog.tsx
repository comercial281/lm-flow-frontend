import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label as UILabel,
} from '@/components/ui/ds';
import { apiErrorMessage, isErrorCode } from '@/utils/apiHelpers';
import {
  metaPagesService,
  type AvailableMetaPage,
  type MetaPage,
} from '@/services/integrations/metaPagesService';

// Janela de "Adicionar página" do Facebook.
//
// O caminho NORMAL é escolher da lista: o servidor pergunta ao Facebook quais
// páginas o acesso da Leal Mídia enxerga e marca as que já estão conectadas —
// ninguém precisa descobrir e digitar o Page ID na mão. O caminho manual (Page
// ID + token) continua como plano B, para página que está num Business Manager
// que o nosso acesso não alcança. Sem token de sistema configurado, a lista nem
// existe (NO_TOKEN) e a janela abre direto no manual.
//
// NÃO há campo de "verify token": o webhook lê esse valor de variável de
// ambiente, nunca da configuração — o campo antigo era decorativo.

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (page: MetaPage) => void;
}

type Mode = 'list' | 'manual';

const emptyManual = { page_id: '', page_name: '', access_token: '' };

export default function AddMetaPageDialog({ open, onOpenChange, onAdded }: Props) {
  const [list, setList] = useState<AvailableMetaPage[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [manual, setManual] = useState(emptyManual);
  // page_id da linha em gravação, ou 'manual' — desabilita só o botão certo.
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setList(null);
    setListError(null);
    setMode('list');
    setManual(emptyManual);
    setSaving(null);

    metaPagesService
      .available()
      .then(pages => { if (alive) setList(pages); })
      .catch(err => {
        if (!alive) return;
        setListError(apiErrorMessage(err, 'Não foi possível listar as páginas.'));
        // Sem token de sistema não existe lista pra escolher: o manual é o único
        // caminho, então a janela já abre nele em vez de mostrar erro e um link.
        if (isErrorCode(err, 'NO_TOKEN')) setMode('manual');
      });
    return () => { alive = false; };
  }, [open]);

  const create = async (key: string, payload: Parameters<typeof metaPagesService.create>[0]) => {
    setSaving(key);
    try {
      const page = await metaPagesService.create(payload);
      onAdded(page);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível conectar a página.'));
    } finally {
      setSaving(null);
    }
  };

  const addFromList = (p: AvailableMetaPage) =>
    create(p.page_id, { page_id: p.page_id, page_name: p.name });

  const addManual = () => {
    const page_id = manual.page_id.trim();
    if (!page_id) {
      toast.error('Informe o Page ID da página.');
      return;
    }
    return create('manual', {
      page_id,
      page_name: manual.page_name.trim() || undefined,
      access_token: manual.access_token.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar página do Facebook</DialogTitle>
          <DialogDescription>
            {mode === 'list'
              ? 'Escolha a página deste cliente entre as que o acesso da Leal Mídia enxerga.'
              : 'Informe a página na mão. Só é preciso quando ela está fora do Business Manager da Leal Mídia.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'list' ? (
          <div className="space-y-3">
            {listError && (
              <p className="text-sm text-amber-600" role="alert">{listError}</p>
            )}
            {!list && !listError && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando as páginas no Facebook…
              </p>
            )}
            {list && list.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma página visível para este acesso.
              </p>
            )}
            {list && list.length > 0 && (
              <ul className="max-h-72 overflow-y-auto divide-y rounded-md border">
                {list.map(p => (
                  <li key={p.page_id} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{p.name || 'Página sem nome'}</span>
                        {p.leads_ok ? (
                          <Badge variant="secondary" className="text-xs">Acesso a leads: ok</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/40">
                            Sem acesso a leads
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{p.page_id}</div>
                    </div>
                    <Button
                      size="sm"
                      variant={p.already_added ? 'outline' : 'default'}
                      disabled={p.already_added || saving !== null}
                      onClick={() => addFromList(p)}
                    >
                      {saving === p.page_id && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                      {p.already_added ? 'Já conectada' : 'Adicionar'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="text-xs text-primary underline underline-offset-2"
              onClick={() => setMode('manual')}
            >
              Não está na lista? Informar Page ID e token
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <UILabel htmlFor="meta-page-id">Page ID (Facebook)</UILabel>
              <Input
                id="meta-page-id"
                placeholder="123456789012345"
                value={manual.page_id}
                onChange={e => setManual(m => ({ ...m, page_id: e.target.value }))}
              />
            </div>
            <div>
              <UILabel htmlFor="meta-page-name">Nome da página</UILabel>
              <Input
                id="meta-page-name"
                placeholder="Como aparece no Facebook"
                value={manual.page_name}
                onChange={e => setManual(m => ({ ...m, page_name: e.target.value }))}
              />
            </div>
            <div>
              <UILabel htmlFor="meta-page-token">Access Token</UILabel>
              <Input
                id="meta-page-token"
                type="password"
                placeholder="EAAxxxxx…"
                value={manual.access_token}
                onChange={e => setManual(m => ({ ...m, access_token: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Em branco, usa o token de sistema da Leal Mídia.
              </p>
            </div>
            {list && (
              <button
                type="button"
                className="text-xs text-primary underline underline-offset-2"
                onClick={() => setMode('list')}
              >
                Voltar para a lista
              </button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving !== null}>
            Cancelar
          </Button>
          {mode === 'manual' && (
            <Button onClick={() => void addManual()} disabled={saving !== null}>
              {saving === 'manual' && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Conectar página
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
