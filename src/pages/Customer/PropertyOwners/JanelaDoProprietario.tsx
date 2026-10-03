import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '@/components/ui/ds';
import {
  propertyOwnersService,
  type DadosDoProprietario,
  type Proprietario,
  type ProprietarioCompleto,
} from '@/services/propertyOwners/propertyOwnersService';

const ESPERA_DA_BUSCA_MS = 300;
// Telefone com menos dígitos que isso ainda não dá para conferir duplicidade.
const MIN_DIGITOS_DO_TELEFONE = 8;

type Campos = Required<Pick<DadosDoProprietario, 'name' | 'phone' | 'phone_secondary' | 'email' | 'document'>>;
type Existente = Pick<Proprietario, 'id' | 'name' | 'phone' | 'phone_secondary' | 'email' | 'document'>;

const dosDados = (p?: Existente | null): Campos => ({
  name: p?.name ?? '',
  phone: p?.phone ?? '',
  phone_secondary: p?.phone_secondary ?? '',
  email: p?.email ?? '',
  document: p?.document ?? '',
});

function Campo({ rotulo, valor, aoMudar, type = 'text' }: {
  rotulo: string; valor: string; aoMudar: (v: string) => void; type?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input id={id} type={type} value={valor} onChange={e => aoMudar(e.target.value)} />
    </div>
  );
}

/**
 * Novo proprietário (sem `proprietario`) ou edição dos dados dele.
 * Telefone que já é de outro proprietário só avisa: pode ser o mesmo dono com
 * outro imóvel, e quem decide é quem cadastra.
 */
export default function JanelaDoProprietario({ aberta, proprietario, aoFechar, aoSalvar }: {
  aberta: boolean;
  proprietario?: Existente | null;
  aoFechar: () => void;
  aoSalvar: (salvo: ProprietarioCompleto) => void;
}) {
  const editando = !!proprietario;
  const [campos, setCampos] = useState<Campos>(() => dosDados(proprietario));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [repetido, setRepetido] = useState(false);

  // Pelo id, não pelo objeto: a tela de trás recarregar o proprietário não
  // pode apagar o que a pessoa está digitando.
  useEffect(() => {
    if (aberta) { setCampos(dosDados(proprietario)); setErro(''); setRepetido(false); }
  }, [aberta, proprietario?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!aberta || editando) return;
    const fone = campos.phone.trim();
    if (fone.replace(/\D/g, '').length < MIN_DIGITOS_DO_TELEFONE) { setRepetido(false); return; }
    let cancelado = false;
    const timer = setTimeout(() => {
      propertyOwnersService.list({ q: fone, per_page: 1 })
        .then(r => { if (!cancelado) setRepetido(r.meta.total > 0); })
        .catch(() => { if (!cancelado) setRepetido(false); });
    }, ESPERA_DA_BUSCA_MS);
    return () => { cancelado = true; clearTimeout(timer); };
  }, [aberta, editando, campos.phone]);

  const mudar = (chave: keyof Campos) => (v: string) => {
    setCampos(c => ({ ...c, [chave]: v }));
    if (chave === 'name') setErro('');
  };

  const salvar = async () => {
    if (!campos.name.trim()) { setErro('Informe o nome do proprietário'); return; }
    setSalvando(true);
    // Na edição, campo apagado vai vazio (limpa); na criação, vazio nem vai.
    const valor = (v: string) => (editando ? v.trim() : v.trim() || undefined);
    const dados: DadosDoProprietario = {
      name: campos.name.trim(),
      phone: valor(campos.phone),
      phone_secondary: valor(campos.phone_secondary),
      email: valor(campos.email),
      document: valor(campos.document),
    };
    try {
      const salvo = editando
        ? await propertyOwnersService.update(proprietario!.id, dados)
        : await propertyOwnersService.create(dados);
      aoSalvar(salvo);
    } catch {
      toast.error('Não foi possível salvar o proprietário');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberta} onOpenChange={o => { if (!o && !salvando) aoFechar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar dados' : 'Novo proprietário'}</DialogTitle>
          <DialogDescription>Só a equipe vê. Nada daqui vai para o site, portais ou IA.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Campo rotulo="Nome" valor={campos.name} aoMudar={mudar('name')} />
          {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
          <Campo rotulo="Telefone" type="tel" valor={campos.phone} aoMudar={mudar('phone')} />
          {repetido && <p className="rounded-md bg-muted p-2 text-sm">Já existe um proprietário com esse telefone</p>}
          <Campo rotulo="Outro telefone" type="tel" valor={campos.phone_secondary} aoMudar={mudar('phone_secondary')} />
          <Campo rotulo="E-mail" type="email" valor={campos.email} aoMudar={mudar('email')} />
          <Campo rotulo="CPF ou CNPJ" valor={campos.document} aoMudar={mudar('document')} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
