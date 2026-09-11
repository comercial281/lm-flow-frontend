import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { SettingsAgentsTour } from '@/tours';
import { toast } from 'sonner';
import { Button } from '@/components/ui/ds';
import { Grid3X3, List, Users as UsersIcon } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';

import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAuthStore } from '@/store/authStore';
import { usersService } from '@/services/users';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { canDeactivate } from '@/features/users/deactivation/deactivationRules';
import { User, UsersListParams, UsersState } from '@/types/users';
import { BaseFilter } from '@/types/core';
import { AppliedFilter } from '@/types/core';

import {
  UserCard,
  UsersHeader,
  UsersTable,
  UsersPagination,
  UserFormModal,
  BulkInviteModal,
  UsersFilter,
  UserDetails,
  DeactivateUserDialog,
} from '@/components/users';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';

const INITIAL_STATE: UsersState = {
  users: [],
  selectedUserIds: [],
  meta: {
    pagination: {
      page: 1,
      page_size: DEFAULT_PAGE_SIZE,
      total: 0,
      total_pages: 0,
      has_next_page: false,
      has_previous_page: false,
    },
  },
  loading: {
    list: false,
    create: false,
    update: false,
    delete: false,
    bulk: false,
  },
  filters: [],
  searchQuery: '',
  sortBy: 'name',
  sortOrder: 'asc',
};

export default function Users() {
  const { t } = useLanguage('users');
  const { can, isReady: permissionsReady } = useUserPermissions();
  const { currentUser } = useAuthStore();
  const [state, setState] = useState<UsersState>(INITIAL_STATE);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [bulkInviteModalOpen, setBulkInviteModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<BaseFilter[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilter[]>([]);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsUser, setDetailsUser] = useState<User | null>(null);
  const currentUserId = currentUser?.id?.toString() || '';
  const hasLoaded = useRef(false);

  // Load users
  const loadUsers = useCallback(
    async (params?: Partial<UsersListParams>) => {
      if (!can('users', 'read')) {
        toast.error(t('messages.permissionDenied.read'));
        return;
      }

      setState(prev => ({ ...prev, loading: { ...prev.loading, list: true } }));

      try {
        const requestParams: UsersListParams = {
          page: 1,
          per_page: DEFAULT_PAGE_SIZE,
          sort: 'name' as any,
          order: 'asc',
          ...params,
        };

        // Adicionar filtros aos parâmetros se existirem
        if (activeFilters.length > 0) {
          const filterParams = activeFilters.reduce((acc, filter, index) => {
            const prefix = `filters[${index}]`;
            acc[`${prefix}[attribute_key]`] = filter.attributeKey;
            acc[`${prefix}[filter_operator]`] = filter.filterOperator;
            acc[`${prefix}[values]`] = Array.isArray(filter.values)
              ? filter.values.join(',')
              : filter.values.toString();
            if (index > 0) {
              acc[`${prefix}[query_operator]`] = filter.queryOperator;
            }
            return acc;
          }, {} as Record<string, any>);

          Object.assign(requestParams, filterParams);
        }

        const response = await usersService.getUsers(requestParams);

        setState(prev => ({
          ...prev,
          users: response.data || [],
          meta: {
            pagination: response.meta.pagination
          },
          loading: { ...prev.loading, list: false },
        }));
      } catch (error) {
        console.error('Error loading users:', error);
        toast.error(t('messages.loadError'));
        setState(prev => ({ ...prev, loading: { ...prev.loading, list: false } }));
      }
    },
    [activeFilters, can, t],
  );

  // Initial load
  useEffect(() => {
    if (!permissionsReady) {
      return;
    }

    if (!hasLoaded.current) {
      hasLoaded.current = true;
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsReady]);

  // Handlers
  const handleSearchChange = (query: string) => {
    setState(prev => ({
      ...prev,
      searchQuery: query,
      meta: {
        ...prev.meta,
        pagination: { ...prev.meta.pagination, page: 1 },
      },
    }));

    // Reload with new search
    loadUsers({ page: 1, q: query || undefined });
  };

  // Funções para o sistema de filtros
  const convertFiltersToApplied = (filters: BaseFilter[]): AppliedFilter[] => {
    return filters.map((filter, index) => ({
      id: `filter-${index}`,
      label: `${filter.attributeKey}: ${
        Array.isArray(filter.values) ? filter.values.join(',') : filter.values
      }`,
      value: Array.isArray(filter.values)
        ? String(filter.values.join(','))
        : (filter.values as string | number),
      onRemove: () => handleRemoveFilter(index),
    }));
  };

  const handleOpenFilter = () => {
    setFilterModalOpen(true);
  };

  const handleApplyFilters = async (filters: BaseFilter[]) => {
    setActiveFilters(filters);
    setAppliedFilters(convertFiltersToApplied(filters));

    setState(prev => ({
      ...prev,
      loading: { ...prev.loading, list: true },
      meta: {
        ...prev.meta,
        pagination: { ...prev.meta.pagination, page: 1 },
      },
    }));

    try {
      await loadUsers({ page: 1 });
    } catch (error) {
      console.error('Error applying filters:', error);
      toast.error(t('messages.filterError'));
    }
  };

  const handleClearFilters = () => {
    setActiveFilters([]);
    setAppliedFilters([]);
    loadUsers({ page: 1 });
  };

  const handleRemoveFilter = (index: number) => {
    const newFilters = activeFilters.filter((_, i) => i !== index);
    if (newFilters.length === 0) {
      handleClearFilters();
    } else {
      handleApplyFilters(newFilters);
    }
  };

  const handlePageChange = (page: number) => {
    setState(prev => ({
      ...prev,
      meta: {
        ...prev.meta,
        pagination: { ...prev.meta.pagination, page },
      },
    }));

    loadUsers({ page });
  };

  const handlePerPageChange = (perPage: number) => {
    setState(prev => ({
      ...prev,
      meta: {
        ...prev.meta,
        pagination: { ...prev.meta.pagination, page_size: perPage, page: 1 },
      },
    }));

    loadUsers({ page: 1, per_page: perPage });
  };

  const handleCreateUser = () => {
    if (!can('users', 'create')) {
      toast.error(t('messages.permissionDenied.create'));
      return;
    }
    setEditingUser(null);
    setUserModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    if (!can('users', 'update')) {
      toast.error(t('messages.permissionDenied.update'));
      return;
    }
    setEditingUser(user);
    setUserModalOpen(true);
  };

  /**
   * ⚠️ Isto DESATIVA, não exclui.
   *
   * O *Excluir* de antes quase nunca apagava de verdade (um lead atendido já
   * cria referência): ele renomeava o e-mail da pessoa para um endereço
   * inventado, randomizava a senha e respondia "excluído com sucesso" — com ela
   * ainda em todas as roletas, com acesso aos canais, dona dos leads e
   * recebendo aviso no WhatsApp. Era um "desativar" por acidente, irreversível.
   */
  const handleDeactivateUser = (user: User) => {
    if (!can('users', 'deactivate')) {
      toast.error(t('messages.permissionDenied.delete'));
      return;
    }
    setUserToDeactivate(user);
    setDeactivateDialogOpen(true);
  };

  /**
   * A volta: devolve o acesso e os canais em que ela atendia. NÃO a recoloca nas
   * roletas (quem religa a torneira é o gestor) e NÃO traz os leads de volta.
   */
  const handleReactivateUser = async (user: User) => {
    if (!can('users', 'deactivate')) {
      toast.error(t('messages.permissionDenied.delete'));
      return;
    }

    try {
      await usersService.reactivate(user.id);
      toast.success(`${user.name} voltou. Ele ainda está fora das roletas — ligue quando quiser.`);
      loadUsers();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Não consegui reativar agora.'));
    }
  };

  const handleBulkInvite = () => {
    if (!can('users', 'create')) {
      toast.error(t('messages.permissionDenied.invite'));
      return;
    }
    setBulkInviteModalOpen(true);
  };

  /**
   * Quem esta pessoa pode desativar: o gestor desativa CORRETOR; gestor e
   * administrador só o administrador desativa. A mesma régua roda no servidor —
   * esta existe para a tela não oferecer um botão que a API vai recusar.
   *
   * O último administrador continua protegido: sem ele ninguém religa ninguém.
   */
  const canDeactivateUser = (user: User) => {
    const actor = state.users.find(u => u.id === currentUserId) ?? null;
    if (!canDeactivate(actor, user)) return false;

    const admins = state.users.filter(u => u.role?.key === 'administrator' && !u.deactivated);
    if (user.role?.key === 'administrator' && admins.length === 1) {
      return false;
    }

    return true;
  };

  // const handleAvailabilityChange = async (userId: string, availability: 'online' | 'busy' | 'offline') => {
  //   const updatedUser = await updateAvailability(userId, availability);
  //   if (updatedUser) {
  //     setState(prev => ({
  //       ...prev,
  //       users: prev.users.map(user =>
  //         user.id === userId ? { ...user, availability_status: availability } : user
  //       )
  //     }));
  //     toast.success('Status de disponibilidade atualizado');
  //   }
  // };

  const handleDeactivated = () => {
    setDeactivateDialogOpen(false);
    setUserToDeactivate(null);
    loadUsers();
  };

  // Handle user form submission
  const handleUserFormSubmit = async () => {
    // Close modal and refresh
    setUserModalOpen(false);
    setEditingUser(null);
    loadUsers();
  };

  const handleBulkInviteSuccess = () => {
    setBulkInviteModalOpen(false);
    loadUsers();
  };

  // Handle modal close
  // const handleUserModalClose = (open: boolean) => {
  //   if (!open) {
  //     setUserModalOpen(false);
  //     setEditingUser(null);
  //   }
  // };

  const handleDetailsModalClose = (open: boolean) => {
    if (!open) {
      setDetailsModalOpen(false);
      setDetailsUser(null);
    }
  };

  return (
    <div className="h-full flex flex-col p-4" data-tour="settings-agents-page">
      <SettingsAgentsTour />
      <div data-tour="settings-agents-header">
        <UsersHeader
          totalCount={state.meta.pagination.total}
          selectedCount={state.selectedUserIds.length}
          searchValue={state.searchQuery}
          onSearchChange={handleSearchChange}
          onNewUser={handleCreateUser}
          onBulkInvite={handleBulkInvite}
          onFilter={handleOpenFilter}
          onClearSelection={() => setState(prev => ({ ...prev, selectedUserIds: [] }))}
          activeFilters={appliedFilters}
          showFilters={true}
        />
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center justify-end mb-3" data-tour="settings-agents-view-toggle">
        <div className="flex items-center border rounded-lg">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('cards')}
            className="border-0 rounded-r-none"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="border-0 rounded-l-none"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto" data-tour="settings-agents-content">
        {state.loading.list ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-muted-foreground">{t('loading')}</div>
          </div>
        ) : state.users.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title={t('empty.title')}
            description={t('empty.description')}
            action={{
              label: t('empty.action'),
              onClick: handleCreateUser,
            }}
            className="h-full"
          />
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {state.users.map(user => (
              <UserCard
                key={user.id}
                user={user}
                onEdit={handleEditUser}
                onDeactivate={handleDeactivateUser}
                onReactivate={handleReactivateUser}
                canDeactivate={canDeactivateUser(user)}
              />
            ))}
          </div>
        ) : (
          <UsersTable
            users={state.users}
            selectedUsers={state.users.filter(user => state.selectedUserIds.includes(user.id))}
            loading={state.loading.list}
            onSelectionChange={users =>
              setState(prev => ({
                ...prev,
                selectedUserIds: users.map(u => u.id),
              }))
            }
            onEditUser={handleEditUser}
            onDeactivateUser={handleDeactivateUser}
            onReactivateUser={handleReactivateUser}
            onCreateUser={handleCreateUser}
            sortBy={state.sortBy}
            sortOrder={state.sortOrder}
            onSort={column => {
              const newOrder =
                state.sortBy === column && state.sortOrder === 'asc' ? 'desc' : 'asc';
              setState(prev => ({ ...prev, sortBy: column, sortOrder: newOrder }));
              loadUsers({ sort: column as any, order: newOrder });
            }}
            getRowKey={(user: User) => user.id.toString()}
            canDeactivateUser={canDeactivateUser}
          />
        )}
      </div>

      {/* Pagination */}
      {state.meta.pagination.total > 0 && (
        <div className="mt-auto pt-4 border-t border-sidebar-border" data-tour="settings-agents-pagination">
          <UsersPagination
            currentPage={state.meta.pagination.page}
            totalPages={state.meta.pagination.total_pages}
            totalCount={state.meta.pagination.total}
            perPage={state.meta.pagination.page_size}
            onPageChange={handlePageChange}
            onPerPageChange={handlePerPageChange}
            loading={state.loading.list}
          />
        </div>
      )}

      {/* Desativar corretor — a janela mostra o que a pessoa carrega antes de
          confirmar, e é ela que impede a meia-desativação. */}
      <DeactivateUserDialog
        open={deactivateDialogOpen}
        user={userToDeactivate}
        users={state.users}
        onClose={() => {
          setDeactivateDialogOpen(false);
          setUserToDeactivate(null);
        }}
        onDone={handleDeactivated}
      />

      {/* User Modal */}
      <UserFormModal
        isOpen={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        user={editingUser}
        onSuccess={handleUserFormSubmit}
      />

      {/* Bulk Invite Modal */}
      <BulkInviteModal
        isOpen={bulkInviteModalOpen}
        onClose={() => setBulkInviteModalOpen(false)}
        onSuccess={handleBulkInviteSuccess}
      />

      {/* Users Filter Modal */}
      <UsersFilter
        open={filterModalOpen}
        onOpenChange={setFilterModalOpen}
        filters={activeFilters}
        onFiltersChange={setActiveFilters}
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
      />

      {/* User Details Modal */}
      <UserDetails
        open={detailsModalOpen}
        onOpenChange={handleDetailsModalClose}
        user={detailsUser}
        onEdit={user => {
          setDetailsModalOpen(false);
          setEditingUser(user);
          setUserModalOpen(true);
        }}
      />
    </div>
  );
}
