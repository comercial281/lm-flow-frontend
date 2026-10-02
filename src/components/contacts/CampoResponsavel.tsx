import { useEffect, useMemo, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { Label } from '@/components/ui/ds';
import { SeletorComAbas, type AbaDoSeletor, type EscolhaComAbas } from '@/components/base/SeletorComAbas';
import { roletaConfigService, roletaLabel, type RoletaConfig } from '@/services/roletaConfig/roletaConfigService';
import type { User } from '@/types/users';
import InicialDoCorretor from './InicialDoCorretor';

/** O que o formulário manda pro servidor. Roleta só no cadastro. */
export interface Responsavel {
  default_assignee_id: string | null;
  roleta_config_id?: string;
}

interface Props {
  /** Corretor: ele mesmo, travado. O servidor força de novo ao salvar. */
  corretor: { id: string; name: string } | null;
  /** Cadastro novo oferece a aba Roleta; a edição não (a roleta sorteia na chegada). */
  isNew: boolean;
  users: User[];
  value: EscolhaComAbas | null;
  onChange: (escolha: EscolhaComAbas) => void;
  erro?: string;
  disabled?: boolean;
}

export function paraResponsavel(escolha: EscolhaComAbas | null): Responsavel {
  if (escolha?.aba === 'roleta') return { default_assignee_id: null, roleta_config_id: escolha.valor };
  if (escolha?.aba === 'corretor') return { default_assignee_id: escolha.valor };
  return { default_assignee_id: null };
}

// Responsável do Novo contato / Editar contato (decisão do dono, 02/10/2026):
// corretor cadastra pra si mesmo, sem roleta nem escolha — ele cria e entra em
// contato. Gestor escolhe um corretor ou manda pra uma roleta, na mesma lista,
// com as abas Corretores | Roleta.
export default function CampoResponsavel({ corretor, isNew, users, value, onChange, erro, disabled }: Props) {
  const [roletas, setRoletas] = useState<RoletaConfig[]>([]);
  const comRoleta = isNew && !corretor;

  useEffect(() => {
    if (!comRoleta) return;
    let vivo = true;
    roletaConfigService.getAll()
      .then(lista => { if (vivo) setRoletas(lista.filter(r => r.is_active)); })
      // Sem acesso às roletas: a aba fica vazia e o gestor escolhe um corretor.
      .catch(() => { if (vivo) setRoletas([]); });
    return () => { vivo = false; };
  }, [comRoleta]);

  const abas = useMemo<AbaDoSeletor[]>(() => {
    const ativos = users.filter(u => !u.deactivated);
    const corretores: AbaDoSeletor = {
      chave: 'corretor',
      rotulo: 'Corretores',
      vazio: 'Ninguém na equipe ainda.',
      opcoes: ativos.map(u => ({ valor: String(u.id), rotulo: u.name, icone: <InicialDoCorretor nome={u.name} /> })),
    };
    // Dono gravado que saiu da lista (desativado) continua aparecendo escolhido:
    // senão a caixa abriria vazia e salvar trocaria o dono sem ninguém ver.
    if (value?.aba === 'corretor' && !corretores.opcoes.some(o => o.valor === value.valor)) {
      corretores.opcoes.push({ valor: value.valor, rotulo: 'Responsável atual (fora da equipe)' });
    }
    if (!comRoleta) return [corretores];
    return [
      corretores,
      {
        chave: 'roleta',
        rotulo: 'Roleta',
        vazio: 'Nenhuma roleta ligada.',
        opcoes: roletas.map(r => ({
          valor: r.id,
          rotulo: roletaLabel(r),
          icone: <Shuffle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />,
        })),
      },
    ];
  }, [users, roletas, comRoleta, value]);

  if (corretor) {
    return (
      <div className="space-y-2">
        <Label>Responsável</Label>
        <p className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm">
          <InicialDoCorretor nome={corretor.name} />
          {corretor.name}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="responsavel">
        Responsável{isNew && <span className="text-destructive"> *</span>}
      </Label>
      <SeletorComAbas
        id="responsavel"
        aria-label="Responsável"
        abas={abas}
        value={value}
        onChange={onChange}
        placeholder={comRoleta ? 'Escolha o corretor ou a roleta' : 'Sem responsável'}
        disabled={disabled}
        invalido={!!erro}
      />
      {value?.aba === 'roleta' && (
        <p className="text-xs text-muted-foreground">Ao salvar, a roleta oferece o contato a um corretor. Ele vira o responsável quando aceitar.</p>
      )}
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
