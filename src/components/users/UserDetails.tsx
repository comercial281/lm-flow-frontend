import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Avatar,
  AvatarFallback,
  Badge,
  Separator,
} from '@/components/ui/ds';
import {
  Edit,
  Mail,
  Clock,
  User as UserIcon,
  History,
  Settings,
  Shield,
} from 'lucide-react';
import { User } from '@/types/users';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLanguage } from '@/hooks/useLanguage';
import Abas from '@/components/base/Abas';
import { useAbaDaJanela } from '@/hooks/useAbaDaJanela';

type AbaDaPessoa = 'overview' | 'activity' | 'settings';

interface UserDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onEdit: (user: User) => void;
  canDelete?: (user: User) => boolean;
}

export default function UserDetails({
  open,
  onOpenChange,
  user,
  onEdit,
}: UserDetailsProps) {
  const { t } = useLanguage('users');
  const [aba, setAba] = useAbaDaJanela<AbaDaPessoa>(open, 'overview');

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-600';
      case 'busy':
        return 'text-orange-600';
      case 'offline':
      default:
        return 'text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    const statusKey = `details.status.${status}`;
    return t(statusKey) || t('details.status.offline');
  };

  const getRoleLabel = (user: User) => {
    // Priorizar role_data se disponível
    if (user.role && user.role.name) {
      return user.role.name
    }
    
    return t('card.customRole');
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                {user.thumbnail ? (
                  <img
                    src={user.thumbnail}
                    alt={user.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <AvatarFallback className="bg-blue-100 text-blue-600 text-lg">
                    {getInitials(user.name)}
                  </AvatarFallback>
                )}
              </Avatar>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  {user.name}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  {/* Desativado não tem status de disponibilidade: ele não
                      entra. "Online" aqui seria a tela mentindo. */}
                  {user.deactivated ? (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {t('table.columns.inactive')}
                    </Badge>
                  ) : (
                    <Badge
                      variant={user.availability === 'online' ? "secondary" : "outline"}
                      className={`text-xs ${getStatusColor(user.availability)}`}
                    >
                      {getStatusLabel(user.availability)}
                    </Badge>
                  )}
                  <Badge variant={user.confirmed ? "secondary" : "outline"} className="text-xs">
                    {user.confirmed ? t('details.status.confirmed') : t('details.status.pending')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t('details.id')}: {user.id}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(user)}
              >
                <Edit className="h-4 w-4 mr-2" />
                {t('details.edit')}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <div className="flex h-full flex-col gap-2">
            <Abas
              rotulo="Partes da ficha da pessoa"
              className="px-6"
              ativa={aba}
              aoTrocar={chave => setAba(chave as AbaDaPessoa)}
              abas={[
                { chave: 'overview', rotulo: t('details.tabs.overview'), icone: UserIcon },
                { chave: 'activity', rotulo: t('details.tabs.activity'), icone: History },
                { chave: 'settings', rotulo: t('details.tabs.settings'), icone: Settings },
              ]}
            />

            {aba === 'overview' && <div className="px-6 py-4 space-y-6">
              {/* Contact Information */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {t('details.contactInfo.title')}
                </h3>
                <div className="space-y-2 bg-muted/30 rounded-lg p-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('details.contactInfo.email')}</span>
                    <span className="font-mono text-sm">{user.email}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Role and Permissions */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {t('details.rolePermissions.title')}
                </h3>
                <div className="space-y-2 bg-muted/30 rounded-lg p-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('details.rolePermissions.role')}</span>
                    <Badge variant="outline">{getRoleLabel(user)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('details.rolePermissions.availability')}</span>
                    <Badge
                      variant={user.availability === 'online' ? "secondary" : "outline"}
                      className={getStatusColor(user.availability)}
                    >
                      {getStatusLabel(user.availability)}
                    </Badge>
                  </div>

                </div>
              </div>

              <Separator />

              {/* Account Status */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  {t('details.accountStatus.title')}
                </h3>
                <div className="space-y-2 bg-muted/30 rounded-lg p-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('details.accountStatus.confirmation')}</span>
                    <Badge variant={user.confirmed ? "secondary" : "outline"}>
                      {user.confirmed ? t('details.accountStatus.confirmed') : t('details.accountStatus.pending')}
                    </Badge>
                  </div>

                  {/* O REGISTRO da desativação.
                      Os leads que foram passados não voltam com a reativação —
                      quem atendeu aquela carteira fez trabalho que não se desfaz
                      por efeito de um clique. Então esta linha é a resposta para
                      "para onde foi a carteira do Fulano?", que é a pergunta que
                      alguém faz uma semana depois. */}
                  {user.deactivated && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Desativado em</span>
                        <span>
                          {user.deactivated_at
                            ? new Date(user.deactivated_at).toLocaleDateString('pt-BR')
                            : '—'}
                        </span>
                      </div>
                      {user.deactivation_snapshot?.transfer_to_name && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Os leads dele foram para</span>
                          <span className="text-right">
                            {user.deactivation_snapshot.transfer_to_name}
                          </span>
                        </div>
                      )}
                      {user.deactivation_snapshot?.exclusive_number?.name &&
                        user.deactivation_snapshot?.disconnect_number && (
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">WhatsApp desconectado</span>
                            <span className="text-right">
                              {user.deactivation_snapshot.exclusive_number.name}
                            </span>
                          </div>
                        )}
                    </>
                  )}
                </div>
              </div>

              <Separator />

              {/* Timestamps */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t('details.timestamps.title')}
                </h3>
                <div className="space-y-2 text-sm">
                  {user.created_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('details.timestamps.created')}</span>
                      <span className="font-mono">
                        {formatDistanceToNow(new Date(user.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  )}
                  {user.updated_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('details.timestamps.lastUpdate')}</span>
                      <span className="font-mono">
                        {formatDistanceToNow(new Date(user.updated_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>}

            {aba === 'activity' && <div className="px-6 py-4">
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t('details.activity.placeholder')}</p>
              </div>
            </div>}

            {aba === 'settings' && <div className="px-6 py-4 space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  {t('details.settingsTab.title')}
                </h3>

                <div className="space-y-4 bg-muted/30 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{t('details.settingsTab.systemRole.title')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('details.settingsTab.systemRole.description')}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {getRoleLabel(user)}
                    </Badge>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{t('details.settingsTab.availabilityStatus.title')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('details.settingsTab.availabilityStatus.description')}
                      </p>
                    </div>
                    <Badge
                      variant={user.availability === 'online' ? "secondary" : "outline"}
                      className={getStatusColor(user.availability)}
                    >
                      {getStatusLabel(user.availability)}
                    </Badge>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{t('details.settingsTab.emailConfirmation.title')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('details.settingsTab.emailConfirmation.description')}
                      </p>
                    </div>
                    <Badge variant={user.confirmed ? "secondary" : "outline"}>
                      {user.confirmed ? t('details.settingsTab.emailConfirmation.verified') : t('details.settingsTab.emailConfirmation.pending')}
                    </Badge>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => onEdit(user)}
                  className="w-full"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {t('details.settingsTab.editSettings')}
                </Button>
              </div>
            </div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
