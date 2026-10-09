import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { teamAccessService } from '@/services/teamAccess/teamAccessService';
import customRolesService from '@/services/customRoles/customRolesService';
import AddPersonWizard from './AddPersonWizard';
import { buildCargoOptions } from './cargoOptions';
// "Adicionar várias de uma vez" abre pelo passo 1 do "Adicionar pessoa".
import BulkAddPeople from './bulk/BulkAddPeople';
import PeopleList from './people/PeopleList';
// A ficha da pessoa (painel lateral) substituiu o "Gerenciar acesso": cargo,
// celular, números, acesso, desativar/reativar e excluir moram lá.
import PersonSheet from './person/PersonSheet';
import CreateNumberDialog from './numbers/CreateNumberDialog';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useNumberOwnerRule } from '@/features/numbers/useNumberOwnerRule';
import type { CustomRole } from '@/types/customRoles';
import type { TeamAccessInbox, TeamAccessMember } from '@/types/teamAccess';

/* Aba "Pessoas" da tela de Equipe — a lista, e a ficha de cada pessoa ao
   clicar na linha. Tudo o que se faz POR PESSOA (cargo, números, celular,
   acesso, desativar, reativar, excluir) mora na ficha (person/PersonSheet).

   ⚠️ O antigo botão de REMOVER saiu daqui, e não é renomeação: ele chamava o excluir,
   que quase nunca apagava de verdade (qualquer lead atendido cria referência).
   O caminho de reserva renomeava o e-mail da pessoa, randomizava a senha e
   respondia "removido" — com ela ainda em todas as roletas, com acesso aos
   números, dona dos leads e recebendo aviso no WhatsApp. Quem faz isso direito
   é o *Desativar*, na ficha, com a janela que mostra o que a pessoa carrega.

   O CARGO exibido vem do cargo de verdade, não de uma lista fixa: enquanto a
   tela conhecia só os três de fábrica, quem tinha cargo próprio (ex.: "SDR")
   aparecia como "Corretor" — o rótulo mentia enquanto a permissão obedecia
   outro. Não desfazer sem o dono pedir. */

export default function PeopleTab() {
  const { can } = useUserPermissions();
  const canCreate = can('users', 'create');

  const [adding, setAdding] = useState(false);
  const [addingMany, setAddingMany] = useState(false);
  // Quem está na janela "Criar número para {nome}" (atalho da lista e da ficha).
  const [creatingNumberFor, setCreatingNumberFor] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamAccessMember[]>([]);
  const [inboxes, setInboxes] = useState<TeamAccessInbox[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  // Fase 2b.1: a regra do dono vale neste cliente? O retrato da equipe traz a
  // resposta do servidor; sem ela (servidor antigo), vale a chave do cliente.
  const [ownerRuleEcho, setOwnerRuleEcho] = useState<boolean | null>(null);
  const numberOwnerRule = useNumberOwnerRule(ownerRuleEcho);

  // A pessoa aberta vem SEMPRE da lista, nunca de uma cópia no estado: com cópia,
  // uma recarga atualizava a linha e deixava a ficha mostrando o valor velho.
  const open = useMemo(() => members.find(m => m.id === openId) ?? null, [members, openId]);

  // Sempre traz os três de fábrica, mesmo quando o cliente não tem cargo nenhum
  // gravado no banco — que é o caso da maioria (ver cargoOptions).
  const creatingNumber = useMemo(() => members.find(m => m.id === creatingNumberFor) ?? null, [members, creatingNumberFor]);

  const cargoOptions = useMemo(() => buildCargoOptions(roles), [roles]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Uma chamada só para o retrato da equipe (antes eram 2 + uma por
      // número) e outra para os cargos que existem neste cliente.
      const [overview, roleList] = await Promise.all([
        teamAccessService.overview(),
        customRolesService.list().catch(() => [] as CustomRole[]),
      ]);
      setMembers(overview.members);
      setInboxes(overview.inboxes);
      setOwnerRuleEcho(overview.number_owner_rule ?? null);
      setRoles(roleList);
    } catch {
      toast.error('Erro ao carregar a equipe');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {members.length} pessoa{members.length !== 1 ? 's' : ''} · cargo e números de cada um
        </p>
        <Button onClick={() => setAdding(true)} disabled={!canCreate} className="gap-1.5">
          <UserPlus className="h-4 w-4" /> Adicionar pessoa
        </Button>
      </div>

      {loading && members.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Carregando equipe…
        </div>
      ) : (
        <PeopleList
          members={members}
          canCreateNumber={can('channels', 'create')}
          onOpen={member => setOpenId(member.id)}
          onCreateNumber={member => setCreatingNumberFor(member.id)}
        />
      )}

      <AddPersonWizard
        open={adding}
        roles={roles}
        inboxes={inboxes}
        members={members}
        onBulk={() => { setAdding(false); setAddingMany(true); }}
        onClose={() => setAdding(false)}
        onCreated={load}
      />

      <BulkAddPeople
        open={addingMany}
        roles={roles}
        members={members}
        onClose={() => setAddingMany(false)}
        onDone={load}
      />

      {creatingNumber && (
        <CreateNumberDialog
          member={creatingNumber}
          open
          onClose={() => setCreatingNumberFor(null)}
          // Recarrega o retrato: a lista e a ficha aberta passam a mostrar o número novo.
          onDone={() => { void load(); }}
        />
      )}

      {open && (
        <PersonSheet
          // Uma ficha por pessoa: trocar de pessoa recomeça o rascunho.
          key={open.id}
          member={open}
          members={members}
          inboxes={inboxes}
          roles={cargoOptions}
          numberOwnerRule={numberOwnerRule}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onCreateNumber={member => setCreatingNumberFor(member.id)}
        />
      )}
    </div>
  );
}
