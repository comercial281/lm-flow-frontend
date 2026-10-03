import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/ds';
import { propertyOwnersService, type Proprietario } from '@/services/propertyOwners/propertyOwnersService';
import { telefone } from '@/lib/formato';
import { CampoTexto } from './campos';
import type { PropsDaSecao } from './tipos';

// Só a equipe vê. O proprietário não vai para site, portal nem IA.
const ESPERA_DA_BUSCA_MS = 300;
const MAXIMO_DE_RESULTADOS = 8;
// Telefone com menos dígitos que isso ainda não dá para conferir duplicidade.
const MIN_DIGITOS_DO_TELEFONE = 8;

type Escolhido = Pick<Proprietario, 'id' | 'name' | 'phone'>;

const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');

const naoEncontrado = (e: unknown) => (e as { response?: { status?: number } })?.response?.status === 404;

export default function SecaoProprietario({ form, setF }: PropsDaSecao) {
  const ownerId = form.owner_id ?? null;
  const [escolhido, setEscolhido] = useState<Escolhido | null>(null);
  const [semAcesso, setSemAcesso] = useState(false);

  // Com owner_id e sem dados na mão (edição ou ?proprietario=), busca o cartão.
  useEffect(() => {
    if (!ownerId) { setEscolhido(null); setSemAcesso(false); return; }
    if (escolhido?.id === ownerId) return;
    let cancelado = false;
    setSemAcesso(false);
    propertyOwnersService.get(ownerId)
      .then(o => { if (!cancelado) setEscolhido(o); })
      .catch(e => { if (!cancelado) { if (naoEncontrado(e)) setSemAcesso(true); else toast.error('Erro ao carregar o proprietário'); } });
    return () => { cancelado = true; };
  }, [ownerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolher = (o: Escolhido) => { setEscolhido(o); setSemAcesso(false); setF({ owner_id: o.id }); };
  const trocar = () => { setEscolhido(null); setSemAcesso(false); setF({ owner_id: null }); };

  if (ownerId) {
    return (
      <div className="mt-4">
        {escolhido ? (
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {iniciais(escolhido.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{escolhido.name}</p>
              {escolhido.phone && <p className="text-xs text-muted-foreground">{telefone(escolhido.phone)}</p>}
            </div>
            <button type="button" onClick={trocar} className="text-sm font-medium text-primary hover:underline">Trocar</button>
          </div>
        ) : semAcesso ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3">
            <p className="text-sm text-muted-foreground">Proprietário sem acesso ou removido</p>
            <button type="button" onClick={trocar} className="text-sm font-medium text-primary hover:underline">Trocar</button>
          </div>
        ) : (
          <div role="status" className="h-16 animate-pulse rounded-lg border bg-muted/40">
            <span className="sr-only">Carregando o proprietário</span>
          </div>
        )}
      </div>
    );
  }
  return <Escolha aoEscolher={escolher} />;
}

function Escolha({ aoEscolher }: { aoEscolher: (o: Escolhido) => void }) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Proprietario[]>([]);
  const [cadastrando, setCadastrando] = useState(false);

  useEffect(() => {
    const q = busca.trim();
    if (!q) { setResultados([]); return; }
    let cancelado = false;
    const timer = setTimeout(() => {
      propertyOwnersService.list({ q, per_page: MAXIMO_DE_RESULTADOS })
        .then(r => { if (!cancelado) setResultados(r.data.slice(0, MAXIMO_DE_RESULTADOS)); })
        .catch(() => { if (!cancelado) setResultados([]); });
    }, ESPERA_DA_BUSCA_MS);
    return () => { cancelado = true; clearTimeout(timer); };
  }, [busca]);

  return (
    <div className="mt-4 space-y-3">
      <Input value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar proprietário"
        placeholder="Buscar proprietário por nome ou telefone" />
      {resultados.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {resultados.map(o => (
            <li key={o.id}>
              <button type="button" onClick={() => aoEscolher(o)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted">
                <span className="truncate font-medium">{o.name}</span>
                {o.phone && <span className="shrink-0 text-xs text-muted-foreground">{telefone(o.phone)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {cadastrando
        ? <NovoProprietario aoCriar={aoEscolher} aoUsarExistente={aoEscolher} aoCancelar={() => setCadastrando(false)} />
        : (
          <button type="button" onClick={() => setCadastrando(true)} className="text-sm font-medium text-primary hover:underline">
            Cadastrar novo proprietário
          </button>
        )}
    </div>
  );
}

function NovoProprietario({ aoCriar, aoUsarExistente, aoCancelar }: {
  aoCriar: (o: Escolhido) => void;
  aoUsarExistente: (o: Escolhido) => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [fone, setFone] = useState('');
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [igual, setIgual] = useState<Proprietario | null>(null);

  // Telefone que já é de alguém: avisa, mas deixa seguir.
  useEffect(() => {
    const digitos = fone.replace(/\D/g, '');
    if (digitos.length < MIN_DIGITOS_DO_TELEFONE) { setIgual(null); return; }
    let cancelado = false;
    const timer = setTimeout(() => {
      propertyOwnersService.list({ q: fone.trim(), per_page: 1 })
        .then(r => { if (!cancelado) setIgual(r.meta.total > 0 ? (r.data[0] ?? null) : null); })
        .catch(() => { if (!cancelado) setIgual(null); });
    }, ESPERA_DA_BUSCA_MS);
    return () => { cancelado = true; clearTimeout(timer); };
  }, [fone]);

  const salvar = async () => {
    if (!nome.trim()) { setErro('Informe o nome do proprietário'); return; }
    setErro('');
    setSalvando(true);
    try {
      const criado = await propertyOwnersService.create({
        name: nome.trim(),
        phone: fone.trim() || undefined,
        email: email.trim() || undefined,
      });
      aoCriar(criado);
    } catch {
      toast.error('Erro ao salvar o proprietário');
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <CampoTexto rotulo="Nome" valor={nome} aoMudar={v => { setNome(v); setErro(''); }} />
      {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
      <CampoTexto rotulo="Telefone" type="tel" valor={fone} aoMudar={setFone} />
      {igual && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-muted p-2 text-sm">
          <span>Já existe um proprietário com esse telefone</span>
          <button type="button" onClick={() => aoUsarExistente(igual)} className="font-medium text-primary hover:underline">Usar este</button>
        </div>
      )}
      <CampoTexto rotulo="E-mail" type="email" valor={email} aoMudar={setEmail} />
      <div className="flex gap-2">
        <button type="button" onClick={salvar} disabled={salvando}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          Salvar proprietário
        </button>
        <button type="button" onClick={aoCancelar} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted">Cancelar</button>
      </div>
    </div>
  );
}
