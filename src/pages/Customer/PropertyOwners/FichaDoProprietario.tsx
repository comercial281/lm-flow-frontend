import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Home, Loader2, MessageCircle, MoreHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button, Dialog, DialogContent, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, Label, Textarea,
} from '@/components/ui/ds';
import { BaseHeader, EmptyState, Pagina } from '@/components/base';
import { useCan } from '@/hooks/useCan';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { cn } from '@/lib/utils';
import { dataCurta, dataHora, dinheiro, telefone } from '@/lib/formato';
import { propertyOwnersService, type ImovelDoProprietario, type ProprietarioCompleto } from '@/services/propertyOwners/propertyOwnersService';
import { propertiesService, type Property } from '@/services/properties/propertiesService';
import { rotuloDoStatus } from '@/features/properties/proprietarios/statusDoProprietario';
import { TONS, rotuloDaSituacao, tipoDoImovel, tomDaSituacao } from '@/features/properties/listingKind';
import PilulaDeStatus from './PilulaDeStatus';
import JanelaDoProprietario from './JanelaDoProprietario';
import JanelaCorretoresAutorizados from './JanelaCorretoresAutorizados';

const VAZIO = 'Nada registrado.';

/** Só dígitos, com 55 na frente quando é número brasileiro sem DDI. */
function digitosParaWhatsapp(fone: string | null): string {
  const d = (fone ?? '').replace(/\D/g, '');
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

function Dado({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm">{valor || '—'}</dd>
    </div>
  );
}

function Cartao({ imovel, gestor, aoAbrirDados }: { imovel: ImovelDoProprietario; gestor: boolean; aoAbrirDados: () => void }) {
  const tipo = tipoDoImovel(imovel);
  const corpo = (
    <>
      {imovel.cover_photo_url ? (
        <img src={imovel.cover_photo_url} alt="" className="h-28 w-full object-cover" />
      ) : (
        <div className="flex h-28 w-full items-center justify-center bg-muted text-muted-foreground">
          <Home className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
      <div className="space-y-1 p-3">
        <p className="text-xs font-semibold text-primary">{imovel.code}</p>
        <p className="truncate text-sm font-medium">{imovel.title}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">{imovel.display_price ?? '—'}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TONS[tomDaSituacao(tipo, imovel.status)])}>
            {rotuloDaSituacao(tipo, imovel.status)}
          </span>
        </div>
      </div>
    </>
  );
  const classe = 'block overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-colors hover:border-primary/40';
  return gestor
    ? <Link to={`/properties/${imovel.id}/editar`} className={classe}>{corpo}</Link>
    : <button type="button" onClick={aoAbrirDados} className={classe}>{corpo}</button>;
}

/** O que o corretor vê do imóvel: só os dados internos (a página de cadastro é do gestor). */
function JanelaDadosInternos({ imovel, aoFechar }: { imovel: ImovelDoProprietario | null; aoFechar: () => void }) {
  const [prop, setProp] = useState<Property | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    setProp(null); setErro(false);
    if (!imovel) return;
    let vivo = true;
    propertiesService.get(imovel.id).then(p => { if (vivo) setProp(p); }).catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [imovel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const i = prop?.internal_info;
  const linhas: [string, string | undefined][] = [
    ['Onde ficam as chaves', i?.keys_location],
    ['Matrícula', i?.registration_number],
    ['Código do IPTU', i?.iptu_code],
    ['Cartório', i?.notary],
    ['Valor de avaliação', i?.appraised_value ? dinheiro(Number(i.appraised_value)) : undefined],
    ['Comentários internos', i?.notes],
  ];
  const preenchidas = linhas.filter(([, v]) => !!v);

  return (
    <Dialog open={!!imovel} onOpenChange={o => { if (!o) aoFechar(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Dados internos de {imovel?.code}</DialogTitle></DialogHeader>
        {erro ? (
          <p role="alert" className="text-sm text-destructive">Não deu para carregar os dados internos.</p>
        ) : !prop ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" />
        ) : (
          <dl className="space-y-2">
            {preenchidas.map(([rotulo, valor]) => <Dado key={rotulo} rotulo={rotulo} valor={valor} />)}
            {prop.on_sign && <p className="text-sm font-medium">Tem placa</p>}
            {preenchidas.length === 0 && !prop.on_sign && <p className="text-sm text-muted-foreground">{VAZIO}</p>}
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function FichaDoProprietario() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = useCan();
  const gestor = can('properties', 'update');
  const podeCadastrar = can('properties', 'create');
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const [dono, setDono] = useState<ProprietarioCompleto | null>(null);
  const [erro, setErro] = useState<'sem-acesso' | 'falha' | null>(null);
  const [notas, setNotas] = useState('');
  const [salvandoNotas, setSalvandoNotas] = useState(false);
  const [editando, setEditando] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);
  const [imovelAberto, setImovelAberto] = useState<ImovelDoProprietario | null>(null);

  // Só troca o dono: o texto das observações é de quem está digitando.
  const aplicar = useCallback((o: ProprietarioCompleto) => setDono(o), []);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    setDono(null); setErro(null);
    propertyOwnersService.get(id).then(o => {
      if (!vivo) return;
      setDono(o); setNotas(o.notes ?? '');
    }).catch(e => {
      if (vivo) setErro((e as { response?: { status?: number } })?.response?.status === 404 ? 'sem-acesso' : 'falha');
    });
    return () => { vivo = false; };
  }, [id, tentativa]);
  const carregar = () => setTentativa(t => t + 1);

  const voltar = (
    <Link to="/property-owners" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />Gestão de proprietários
    </Link>
  );
  if (erro) {
    return (
      <Pagina estreita acima={voltar} cabecalho={<BaseHeader title="Proprietário" />}>
        {erro === 'sem-acesso'
          ? <EmptyState tipo="erro" description="Proprietário não encontrado ou sem acesso." aoTentarDeNovo={() => navigate('/property-owners')} />
          : <EmptyState tipo="erro" aoTentarDeNovo={carregar} />}
      </Pagina>
    );
  }
  if (!dono) {
    return (
      <Pagina estreita acima={voltar} cabecalho={<BaseHeader title="Proprietário" />}>
        <div role="status"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" /></div>
      </Pagina>
    );
  }

  const digitos = digitosParaWhatsapp(dono.phone);
  const mudouNotas = notas !== (dono.notes ?? '');

  const salvarNotas = async () => {
    setSalvandoNotas(true);
    try {
      const enviado = notas;
      const salvo = await propertyOwnersService.salvarObservacoes(dono.id, enviado);
      setDono(salvo);
      // Se a pessoa digitou mais durante o pedido, o texto novo fica.
      setNotas(atual => (atual === enviado ? salvo.notes ?? '' : atual));
    } catch {
      toast.error('Não foi possível salvar as observações');
    } finally {
      setSalvandoNotas(false);
    }
  };

  const excluir = async () => {
    if (!(await confirmar({
      titulo: 'Excluir proprietário',
      descricao: 'Os imóveis dele ficam sem proprietário.',
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    }))) return;
    try {
      await propertyOwnersService.remove(dono.id);
      navigate('/property-owners');
    } catch {
      toast.error('Não foi possível excluir o proprietário');
    }
  };

  return (
    <Pagina
      estreita
      acima={voltar}
      cabecalho={
        <BaseHeader
          title={<span className="inline-flex flex-wrap items-center gap-3">{dono.name}<PilulaDeStatus id={dono.id} status={dono.status} aoMudar={aplicar} /></span>}
          aDireita={
            <div className="flex items-center gap-2">
              {digitos && (
                <Button asChild variant="outline">
                  <a href={`https://wa.me/${digitos}`} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />WhatsApp
                  </a>
                </Button>
              )}
              {gestor && <Button variant="outline" onClick={() => setEditando(true)}>Editar dados</Button>}
              {gestor && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Mais ações"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-destructive" onClick={() => void excluir()}>Excluir proprietário</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          }
        />
      }
    >

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Imóveis dele</h2>
          {podeCadastrar && (
            <Button asChild size="sm">
              <Link to={`/properties/new?tipo=revenda&proprietario=${dono.id}`}>
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />Cadastrar imóvel deste proprietário
              </Link>
            </Button>
          )}
        </div>
        {dono.properties.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum imóvel ligado a este proprietário.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dono.properties.map(p => <Cartao key={p.id} imovel={p} gestor={gestor} aoAbrirDados={() => setImovelAberto(p)} />)}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <Label htmlFor="notas-do-proprietario" className="text-base font-semibold">Observações internas</Label>
        <Textarea id="notas-do-proprietario" rows={4} value={notas} onChange={e => setNotas(e.target.value)} />
        {mudouNotas && (
          <Button onClick={() => void salvarNotas()} disabled={salvandoNotas}>Salvar observações</Button>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Dados</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Dado rotulo="CPF ou CNPJ" valor={dono.document} />
          <Dado rotulo="Telefone" valor={telefone(dono.phone)} />
          <Dado rotulo="Outro telefone" valor={telefone(dono.phone_secondary)} />
          <Dado rotulo="E-mail" valor={dono.email} />
          <Dado rotulo="Proprietário desde" valor={dataCurta(dono.created_at)} />
          <Dado rotulo="Captado por" valor={dono.captor?.name} />
        </dl>
      </section>

      {gestor && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Corretores autorizados</h2>
            <Button variant="outline" size="sm" onClick={() => setEscolhendo(true)}>Escolher corretores</Button>
          </div>
          {dono.authorized_users.length === 0 ? (
            <p className="text-sm text-muted-foreground">{dono.captor ? 'Só quem captou e a gestão veem este proprietário.' : 'Só a gestão vê este proprietário.'}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {dono.authorized_users.map(u => <li key={u.id} className="rounded-full border px-2.5 py-0.5 text-sm">{u.name}</li>)}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Histórico de status</h2>
        {dono.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma troca ainda.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {[...dono.history].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).map((h, i) => (
              <li key={`${h.at}-${h.to}-${i}`}>
                {dataHora(h.at)} · {h.user?.name ?? 'Sistema'} · {h.from ? rotuloDoStatus(h.from) : 'Novo'} → {rotuloDoStatus(h.to)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {gestor && (
        <>
          <JanelaDoProprietario aberta={editando} proprietario={dono} aoFechar={() => setEditando(false)}
            aoSalvar={o => { aplicar(o); setEditando(false); }} />
          <JanelaCorretoresAutorizados aberta={escolhendo} proprietario={dono} aoFechar={() => setEscolhendo(false)}
            aoSalvar={o => { aplicar(o); setEscolhendo(false); }} />
        </>
      )}
      <JanelaDadosInternos imovel={imovelAberto} aoFechar={() => setImovelAberto(null)} />
      {dialogoDeConfirmacao}
    </Pagina>
  );
}
