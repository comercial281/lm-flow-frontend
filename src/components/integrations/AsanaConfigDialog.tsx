import { useState, useEffect } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Checkbox,
  Label,
} from '@/components/ui/ds';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { toast } from 'sonner';
import AsanaService from '@/services/integrations/asanaService';
import { MCPTool, AsanaConfig } from '@/types/integrations';
import Aviso from '@/components/base/Aviso';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';

interface AsanaConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: AsanaConfig) => void;
  onDisconnect?: () => void;
  initialConfig?: Partial<AsanaConfig>;
  agentId: string;
}

const AsanaConfigDialog = ({
  open,
  onOpenChange,
  onSave,
  onDisconnect,
  initialConfig,
  agentId,
}: AsanaConfigDialogProps) => {
  const { t } = useLanguage('aiAgents');

  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  // Erro ao buscar as ferramentas não pode aparecer como "Nenhuma ferramenta"
  const [erroFerramentas, setErroFerramentas] = useState(false);
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [config, setConfig] = useState<AsanaConfig>({
    provider: 'asana',
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
      const loadedConfig = await AsanaService.getConfiguration(agentId);
      if (loadedConfig) {
        setConfig({
          provider: 'asana',
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
          provider: 'asana',
          username: '',
          email: '',
          connected: false,
          tools: [],
        });
      }
    } catch (error) {
      console.error('Error loading Asana configuration:', error);
      setConfig({
        provider: 'asana',
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
      const response = await AsanaService.discoverTools(agentId);
      setAvailableTools(response.tools || []);
      setErroFerramentas(false);
    } catch (error) {
      setErroFerramentas(true);
      console.error('Error loading Asana tools:', error);
      toast.error('Erro ao carregar ferramentas disponíveis');
    } finally {
      setIsLoadingTools(false);
    }
  };

  const handleConnectAsana = async () => {
    setIsConnecting(true);
    try {
      const response = await AsanaService.generateAuthorization(agentId);

      if (response.url) {
        // Redirect to Asana OAuth
        window.location.href = response.url;
      }
    } catch (error) {
      console.error('Error connecting to Asana:', error);
      toast.error('Erro ao conectar com Asana');
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
      await AsanaService.saveConfiguration(agentId, updatedConfig);

      // Then update local state
      onSave(updatedConfig);
      toast.success('Configurações salvas com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving Asana configuration:', error);
      toast.error(apiErrorMessage(error, 'Erro ao salvar'));
    }
  };

  const handleDisconnect = async () => {
    try {
      await AsanaService.disconnect(agentId);
      if (onDisconnect) {
        onDisconnect();
      }
      toast.success('Asana desconectado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error disconnecting Asana:', error);
      toast.error('Erro ao desconectar Asana');
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
            <img src="/integrations/asana.png" alt="Asana" className="h-5 w-5" />
            {t('edit.integrations.asana.configTitle') || 'Configurar Asana.com'}
          </DialogTitle>
        </DialogHeader>

        {!config.connected ? (
          /* Not connected - Show connect screen */
          <div className="space-y-6 py-4">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-4 bg-primary/10 rounded-full">
                  <img src="/integrations/asana.png" alt="Asana" className="h-12 w-12" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {t('edit.integrations.asana.connectTitle') || 'Conectar com Asana.com'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('edit.integrations.asana.connectDescription') ||
                    'Conecte sua conta Asana.com para permitir que o agente acesse boards, itens e automações'}
                </p>
              </div>
            </div>

            <Button
              onClick={handleConnectAsana}
              disabled={isConnecting}
              className="w-full"
              size="lg"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('edit.integrations.asana.connecting') || 'Conectando...'}
                </>
              ) : (
                <>
                  <img src="/integrations/asana.png" alt="Asana" className="mr-2 h-4 w-4" />
                  {t('edit.integrations.asana.connectButton') || 'Conectar com Asana.com'}
                </>
              )}
            </Button>
          </div>
        ) : (
          /* Connected - Show configuration */
          <>
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <Aviso tom="sucesso" titulo={t('edit.integrations.asana.connected') || 'Conectado'}>
                  {config.username && (
                    <p>
                      {t('edit.integrations.asana.connectedAs') || 'Conectado como'}:{' '}
                      <strong>{config.username}</strong>
                    </p>
                  )}
                  {config.email && <p>{config.email}</p>}
                </Aviso>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t('edit.integrations.asana.connectedDescription') ||
                      'O agente agora pode acessar boards, itens e outras informações do Asana.'}
                  </p>
                </div>
              </div>

              {/* Tools Selection */}
              <div className="space-y-3 pt-4 border-t">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">
                      {t('edit.integrations.asana.toolsTitle') || 'Ferramentas Disponíveis'}
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
                          {t('edit.integrations.asana.selectAll') || 'Selecionar todas'}
                        </Label>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t('edit.integrations.asana.toolsDescription') ||
                      'Selecione quais ferramentas do Asana o agente poderá usar'}
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
                    title={t('edit.integrations.asana.noTools') || 'Nenhuma ferramenta disponível'}
                  />
                )}
              </div>
            </div>

            <DialogFooter className={onDisconnect ? 'sm:justify-between' : undefined}>
              {onDisconnect && (
                <Button
                  variant="ghost"
                  onClick={handleDisconnect}
                  className="text-destructive hover:text-destructive/80"
                >
                  {t('edit.integrations.asana.disconnect') || 'Desconectar'}
                </Button>
              )}
              <Button onClick={handleSave}>
                {t('edit.integrations.asana.saveConfig') || 'Salvar'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AsanaConfigDialog;
