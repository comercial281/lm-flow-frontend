import { useState, useEffect } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Checkbox,
  Label,
} from '@/components/ui/ds';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { toast } from 'sonner';
import MondayService from '@/services/integrations/mondayService';
import { MCPTool, MondayConfig } from '@/types/integrations';
import Aviso from '@/components/base/Aviso';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';

interface MondayConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: MondayConfig) => void;
  onDisconnect?: () => void;
  initialConfig?: Partial<MondayConfig>;
  agentId: string;
}

const MondayConfigDialog = ({
  open,
  onOpenChange,
  onSave,
  onDisconnect,
  initialConfig,
  agentId,
}: MondayConfigDialogProps) => {
  const { t } = useLanguage('aiAgents');

  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  // Erro ao buscar as ferramentas não pode aparecer como "Nenhuma ferramenta"
  const [erroFerramentas, setErroFerramentas] = useState(false);
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [config, setConfig] = useState<MondayConfig>({
    provider: 'monday',
    username: initialConfig?.username || '',
    email: initialConfig?.email || '',
    connected: initialConfig?.connected || false,
    tools: initialConfig?.tools || [],
  });

  // Load configuration when dialog opens
  useEffect(() => {
    if (open) {
      loadConfiguration();
    }
  }, [open, agentId]);

  const loadConfiguration = async () => {
    setIsLoading(true);
    try {
      const loadedConfig = await MondayService.getConfiguration(agentId);
      if (loadedConfig) {
        setConfig({
          provider: 'monday',
          username: loadedConfig.username || '',
          email: loadedConfig.email || '',
          connected: loadedConfig.connected || false,
          tools: loadedConfig.tools || [],
        });
        setSelectedTools(loadedConfig.tools || []);

        // If connected, load available tools
        if (loadedConfig.connected) {
          loadAvailableTools();
        }
      } else {
        setConfig({
          provider: 'monday',
          username: '',
          email: '',
          connected: false,
          tools: [],
        });
      }
    } catch (error) {
      console.error('Error loading Monday configuration:', error);
      setConfig({
        provider: 'monday',
        username: '',
        email: '',
        connected: false,
        tools: [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableTools = async () => {
    setIsLoadingTools(true);
    try {
      const response = await MondayService.discoverTools(agentId);
      setAvailableTools(response.tools || []);
      setErroFerramentas(false);
    } catch (error) {
      setErroFerramentas(true);
      console.error('Error loading Monday tools:', error);
      toast.error('Erro ao carregar ferramentas disponíveis');
    } finally {
      setIsLoadingTools(false);
    }
  };

  const handleConnectMonday = async () => {
    setIsConnecting(true);
    try {
      const response = await MondayService.generateAuthorization(agentId);

      if (response.url) {
        // Redirect to Monday OAuth
        window.location.href = response.url;
      }
    } catch (error) {
      console.error('Error connecting to Monday:', error);
      toast.error('Erro ao conectar com Monday');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleToolToggle = (toolName: string) => {
    setSelectedTools(prev => {
      if (prev.includes(toolName)) {
        return prev.filter(t => t !== toolName);
      } else {
        return [...prev, toolName];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedTools.length === availableTools.length) {
      // If all are selected, deselect all
      setSelectedTools([]);
    } else {
      // Select all tools
      setSelectedTools(availableTools.map(tool => tool.name));
    }
  };

  const handleSave = async () => {
    try {
      const updatedConfig = {
        ...config,
        tools: selectedTools,
      };

      // Save configuration to backend
      await MondayService.saveConfiguration(agentId, updatedConfig);

      // Then update local state
      onSave(updatedConfig);
      toast.success('Configurações salvas com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving Monday configuration:', error);
      toast.error(apiErrorMessage(error, 'Erro ao salvar'));
    }
  };

  const handleDisconnect = async () => {
    try {
      await MondayService.disconnect(agentId);
      if (onDisconnect) {
        onDisconnect();
      }
      toast.success('Monday desconectado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error disconnecting Monday:', error);
      toast.error('Erro ao desconectar Monday');
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <Carregando variante="texto" linhas={4} className="p-4" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src="/integrations/monday.png" alt="Monday" className="h-5 w-5" />
            {t('edit.integrations.monday.configTitle') || 'Configurar Monday.com'}
          </DialogTitle>
        </DialogHeader>

        {!config.connected ? (
          /* Not connected - Show connect screen */
          <div className="space-y-6 py-4">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-4 bg-primary/10 rounded-full">
                  <img src="/integrations/monday.png" alt="Monday" className="h-12 w-12" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {t('edit.integrations.monday.connectTitle') || 'Conectar com Monday.com'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('edit.integrations.monday.connectDescription') ||
                    'Conecte sua conta Monday.com para permitir que o agente acesse boards, itens e automações'}
                </p>
              </div>
            </div>

            <Button
              onClick={handleConnectMonday}
              disabled={isConnecting}
              className="w-full"
              size="lg"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('edit.integrations.monday.connecting') || 'Conectando...'}
                </>
              ) : (
                <>
                  <img src="/integrations/monday.png" alt="Monday" className="mr-2 h-4 w-4" />
                  {t('edit.integrations.monday.connectButton') || 'Conectar com Monday.com'}
                </>
              )}
            </Button>
          </div>
        ) : (
          /* Connected - Show configuration */
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <Aviso tom="sucesso" titulo={t('edit.integrations.monday.connected') || 'Conectado'}>
                {config.username && (
                  <p>
                    {t('edit.integrations.monday.connectedAs') || 'Conectado como'}:{' '}
                    <strong>{config.username}</strong>
                  </p>
                )}
                {config.email && <p>{config.email}</p>}
              </Aviso>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('edit.integrations.monday.connectedDescription') ||
                    'O agente agora pode acessar boards, itens e outras informações do Monday.'}
                </p>
              </div>
            </div>

            {/* Tools Selection */}
            <div className="space-y-3 pt-4 border-t">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">
                    {t('edit.integrations.monday.toolsTitle') || 'Ferramentas Disponíveis'}
                  </h4>
                  {availableTools.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="select-all"
                        checked={
                          selectedTools.length === availableTools.length &&
                          availableTools.length > 0
                        }
                        onCheckedChange={handleSelectAll}
                      />
                      <Label htmlFor="select-all" className="text-xs font-medium cursor-pointer">
                        {t('edit.integrations.monday.selectAll') || 'Selecionar todas'}
                      </Label>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('edit.integrations.monday.toolsDescription') ||
                    'Selecione quais ferramentas do Monday o agente poderá usar'}
                </p>
              </div>

              {isLoadingTools ? (
                <Carregando linhas={3} />
              ) : erroFerramentas ? (
                <EmptyState
                  tipo="erro"
                  tamanho="compacto"
                  aoTentarDeNovo={() => void loadAvailableTools()}
                />
              ) : availableTools.length > 0 ? (
                <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-3">
                  {availableTools.map(tool => (
                    <div
                      key={tool.id}
                      className="flex items-start space-x-3 p-2 hover:bg-accent rounded-md"
                    >
                      <Checkbox
                        id={tool.id}
                        checked={selectedTools.includes(tool.name)}
                        onCheckedChange={() => handleToolToggle(tool.name)}
                      />
                      <div className="flex-1">
                        <Label htmlFor={tool.id} className="text-sm font-medium cursor-pointer">
                          {tool.name}
                        </Label>
                        {tool.description && (
                          <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  tamanho="compacto"
                  title={t('edit.integrations.monday.noTools') || 'Nenhuma ferramenta disponível'}
                />
              )}
            </div>

            <div className="flex flex-col gap-3 pt-4 border-t">
              <Button onClick={handleSave} className="w-full">
                {t('edit.integrations.monday.saveConfig') || 'Salvar'}
              </Button>

              {onDisconnect && (
                <Button
                  variant="ghost"
                  onClick={handleDisconnect}
                  className="w-full text-destructive hover:text-destructive/80"
                >
                  {t('edit.integrations.monday.disconnect') || 'Desconectar'}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MondayConfigDialog;
