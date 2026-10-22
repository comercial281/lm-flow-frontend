import { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Checkbox,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ds';
import Abas from '@/components/base/Abas';
import { useAbaDaJanela } from '@/hooks/useAbaDaJanela';
import { X, Users } from 'lucide-react';
import { Pipeline, UpdatePipelineData } from '@/types/analytics';
import TeamsService from '@/services/teams/teamsService';
import { Team } from '@/types/users/teams';
import Carregando from '@/components/base/Carregando';
import Aviso from '@/components/base/Aviso';
import { CampoDaJanela, GradeDaJanela } from '@/components/base/janela';
import { LocalAttributeDefinition, LocalAttributeDefinitionPayload } from '@/types/pipelines/localAttributeDefinition';
import PipelineCustomAttributes from './PipelineCustomAttributes';
import { PIPE_ENTRY_SOURCES } from '@/constants/pipeEntrySources';

type AbaDoFunil = 'details' | 'entry' | 'attributes';

interface EditPipelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline: Pipeline;
  onSubmit: (data: UpdatePipelineData) => void;
  loading: boolean;
}

export default function EditPipelineModal({
  open,
  onOpenChange,
  pipeline,
  onSubmit,
  loading,
}: EditPipelineModalProps) {
  const { t } = useLanguage('pipelines');
  const [formData, setFormData] = useState<UpdatePipelineData>({
    name: pipeline.name,
    description: pipeline.description || '',
    pipeline_type: pipeline.pipeline_type,
    visibility: pipeline.visibility,
    is_active: pipeline.is_active,
  });
  const [aba, setAba] = useAbaDaJanela<AbaDoFunil>(open, 'details');
  const [teamIds, setTeamIds] = useState<string[]>(pipeline.team_ids || []);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [customAttributes, setCustomAttributes] = useState<Record<string, unknown>>({});
  // Origens que entram automaticamente NESTA pipeline.
  // null = herda o padrão do cliente; array = regra própria ([] = nada entra).
  const [entrySources, setEntrySources] = useState<string[] | null>(
    Array.isArray(pipeline.pipe_entry_sources) ? pipeline.pipe_entry_sources : null,
  );

  useEffect(() => {
    // Update form data when pipeline changes
    setFormData({
      name: pipeline.name,
      description: pipeline.description || '',
      pipeline_type: pipeline.pipeline_type,
      visibility: pipeline.visibility,
      is_active: pipeline.is_active,
    });
    setTeamIds(pipeline.team_ids || []);
    setEntrySources(Array.isArray(pipeline.pipe_entry_sources) ? pipeline.pipe_entry_sources : null);
    // Load attributes array from custom_fields.attributes
    // Structure: custom_fields = { attributes: ["key1", "key2", ...] }
    const attributesArray = (pipeline.custom_fields?.attributes as string[]) || [];
    const localDefinitions =
      (pipeline.custom_fields?.attribute_definitions as Record<string, LocalAttributeDefinitionPayload>) || {};
    const createdAttributes: Record<string, unknown> = {};
    attributesArray.forEach(key => {
      const localDefinition = localDefinitions[key];
      createdAttributes[key] = localDefinition
        ? {
            __local_definition: true,
            ...localDefinition,
          }
        : null;
    });
    Object.entries(localDefinitions).forEach(([key, definition]) => {
      if (!createdAttributes[key]) {
        createdAttributes[key] = {
          __local_definition: true,
          ...definition,
        };
      }
    });
    setCustomAttributes(createdAttributes);
  }, [pipeline]);

  // Load teams when visibility is 'team'
  useEffect(() => {
    if (formData.visibility === 'team' && teams.length === 0) {
      setTeamsLoading(true);
      TeamsService.getTeams({ page: 1, per_page: 100, sort: 'name', order: 'asc' })
        .then(response => setTeams(response.data))
        .catch(err => console.error('Error loading teams:', err))
        .finally(() => setTeamsLoading(false));
    }
    if (formData.visibility !== 'team') {
      setTeamIds([]);
    }
  }, [formData.visibility]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;
    if (formData.visibility === 'team' && teamIds.length === 0) return;

    const attributeKeys = Object.keys(customAttributes);
    const attributeDefinitions = Object.entries(customAttributes).reduce(
      (acc, [key, value]) => {
        if (value && typeof value === 'object' && (value as LocalAttributeDefinition).__local_definition) {
          const localDefinition = value as LocalAttributeDefinition;
          acc[key] = {
            attribute_display_name: localDefinition.attribute_display_name,
            attribute_display_type: localDefinition.attribute_display_type,
            ...(localDefinition.attribute_values?.length
              ? { attribute_values: localDefinition.attribute_values }
              : {}),
          };
        }
        return acc;
      },
      {} as Record<string, LocalAttributeDefinitionPayload>,
    );

    const existingCustomFields = { ...(pipeline.custom_fields || {}) };
    delete (existingCustomFields as Record<string, unknown>).attributes;
    delete (existingCustomFields as Record<string, unknown>).attribute_definitions;

    const submitData: UpdatePipelineData = {
      ...formData,
      team_ids: formData.visibility === 'team' ? teamIds : [],
      custom_fields: attributeKeys.length > 0
        ? {
            ...existingCustomFields,
            attributes: attributeKeys,
            ...(Object.keys(attributeDefinitions).length > 0
              ? { attribute_definitions: attributeDefinitions }
              : {}),
          }
        : undefined,
      // Só manda a regra de origem quando a pipeline tem regra própria. null =
      // herda o padrão do cliente, e o backend preserva o que já está.
      // Sempre manda: array = regra propria desta pipeline; null = limpa a regra e
      // volta a herdar o padrao do cliente (sem isso nao havia como desfazer).
      pipe_entry_sources: entrySources,
    };

    onSubmit(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DialogHeader>
            <DialogTitle>{t('editPipeline.title')}</DialogTitle>
            <DialogDescription>
              {t('editPipeline.description', { name: pipeline.name })}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-1 flex-col gap-2 min-h-0">
            <Abas
              rotulo={t('editPipeline.title')}
              ativa={aba}
              aoTrocar={chave => setAba(chave as AbaDoFunil)}
              abas={[
                { chave: 'details', rotulo: t('editPipeline.details') },
                { chave: 'entry', rotulo: 'Entrada de leads' },
                { chave: 'attributes', rotulo: t('editPipeline.customAttributes') },
              ]}
            />

            {aba === 'details' && <div className="py-4 overflow-y-auto flex-1">
              <GradeDaJanela>
            {/* Name */}
            <CampoDaJanela rotulo={t('editPipeline.name')} htmlFor="edit-name" colunas={4}>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('editPipeline.namePlaceholder')}
                required
                disabled={loading}
              />
            </CampoDaJanela>

            {/* Description */}
            <CampoDaJanela rotulo={t('editPipeline.descriptionLabel')} htmlFor="edit-description" colunas={4}>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('editPipeline.descriptionPlaceholder')}
                rows={3}
                disabled={loading}
              />
            </CampoDaJanela>

            {/* Pipeline Type */}
            <CampoDaJanela rotulo={t('editPipeline.pipelineType')} htmlFor="edit-type" colunas={2}>
              <Select
                value={formData.pipeline_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, pipeline_type: value as UpdatePipelineData['pipeline_type'] })
                }
                disabled={loading}
              >
                <SelectTrigger id="edit-type" className="w-full">
                  <SelectValue placeholder={t('editPipeline.selectType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">{t('editPipeline.types.custom')}</SelectItem>
                  <SelectItem value="sales">{t('editPipeline.types.sales')}</SelectItem>
                  <SelectItem value="support">{t('editPipeline.types.support')}</SelectItem>
                  <SelectItem value="marketing">{t('editPipeline.types.marketing')}</SelectItem>
                  {/* Funis de imóvel: sem estas opções o campo abria vazio. */}
                  <SelectItem value="sale">{t('editPipeline.types.sale')}</SelectItem>
                  <SelectItem value="rental">{t('editPipeline.types.rental')}</SelectItem>
                  {/* Implantação só aparece em funil que já tem esse tipo. */}
                  {pipeline.pipeline_type === 'onboarding' && (
                    <SelectItem value="onboarding">{t('editPipeline.types.onboarding')}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </CampoDaJanela>

            {/* Visibility */}
            <CampoDaJanela rotulo={t('editPipeline.visibility')} htmlFor="edit-visibility" colunas={2}>
              <Select
                value={formData.visibility}
                onValueChange={(value: 'private' | 'public' | 'team') =>
                  setFormData({ ...formData, visibility: value })
                }
                disabled={loading}
              >
                <SelectTrigger id="edit-visibility" className="w-full">
                  <SelectValue placeholder={t('editPipeline.selectVisibility')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">{t('editPipeline.visibilityOptions.private')}</SelectItem>
                  <SelectItem value="public">{t('editPipeline.visibilityOptions.public')}</SelectItem>
                  <SelectItem value="team">{t('editPipeline.visibilityOptions.team')}</SelectItem>
                </SelectContent>
              </Select>
            </CampoDaJanela>

            {/* Team Selection - conditional on visibility === 'team' */}
            {formData.visibility === 'team' && (
              <CampoDaJanela rotulo={t('editPipeline.teamSelection.label')} colunas={4}>
                {teamIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {teamIds.map(id => {
                      const team = teams.find(t => t.id === id);
                      return team ? (
                        <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs">
                          <Users className="h-3 w-3" />
                          {team.name}
                          <button
                            type="button"
                            onClick={() => setTeamIds(prev => prev.filter(tid => tid !== id))}
                            aria-label={`Remover ${team.name}`}
                            title={`Remover ${team.name}`}
                            className="hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                <div className="border rounded-lg max-h-36 overflow-y-auto">
                  {teamsLoading ? (
                    <Carregando linhas={2} className="px-3" />
                  ) : teams.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-4">
                      {t('editPipeline.teamSelection.noTeams')}
                    </div>
                  ) : (
                    <div className="p-1.5 space-y-0.5">
                      {teams.map(team => (
                        <label key={team.id} className="flex items-center gap-2 p-1.5 hover:bg-muted/50 rounded cursor-pointer">
                          <Checkbox
                            checked={teamIds.includes(team.id)}
                            onCheckedChange={() => {
                              setTeamIds(prev =>
                                prev.includes(team.id) ? prev.filter(tid => tid !== team.id) : [...prev, team.id]
                              );
                            }}
                            disabled={loading}
                          />
                          <span className="text-sm">{team.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {teamIds.length === 0 && (
                  <p className="text-xs text-destructive">{t('editPipeline.teamSelection.required')}</p>
                )}
              </CampoDaJanela>
            )}

            {/* Active Status (espera o Salvar, por isso Checkbox e não Chave) */}
            <div className="flex items-center gap-2 sm:col-span-4">
              <Checkbox
                id="edit-is_active"
                checked={!!formData.is_active}
                onCheckedChange={(marcado) => setFormData({ ...formData, is_active: marcado === true })}
                disabled={loading}
              />
              <Label htmlFor="edit-is_active" className="cursor-pointer">
                {t('editPipeline.pipelineActive')}
              </Label>
            </div>
              </GradeDaJanela>
            </div>}

            {aba === 'entry' && <div className="py-4 overflow-y-auto flex-1">
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-1">Quais leads entram neste funil</h3>
                <p className="text-sm text-muted-foreground">
                  Escolha as origens que entram aqui automaticamente. Assim dá pra ter um funil
                  que recebe todos os leads e outro que só recebe os de anúncio.
                </p>
              </div>

              <label className="flex items-start gap-2 mb-4 cursor-pointer">
                <Checkbox
                  className="mt-1"
                  checked={entrySources === null}
                  onCheckedChange={(v) => setEntrySources(v === true ? null : [...PIPE_ENTRY_SOURCES.map(s => s.key)])}
                />
                <span>
                  <span className="text-sm font-medium">Usar o padrão do cliente</span>
                  <span className="block text-xs text-muted-foreground">
                    Segue o que está configurado em Funções do cliente. Desmarque para este funil
                    ter regra própria.
                  </span>
                </span>
              </label>

              {entrySources !== null && (
                <div className="space-y-2 pl-1">
                  {PIPE_ENTRY_SOURCES.map((src) => (
                    <label key={src.key} className="flex items-start gap-2 cursor-pointer">
                      <Checkbox
                        className="mt-1"
                        checked={entrySources.includes(src.key)}
                        onCheckedChange={(v) => setEntrySources(
                            v === true
                              ? [...entrySources, src.key]
                              : entrySources.filter((s) => s !== src.key),
                          )}
                      />
                      <span>
                        <span className="text-sm font-medium">{src.label}</span>
                        <span className="block text-xs text-muted-foreground">{src.desc}</span>
                      </span>
                    </label>
                  ))}
                  {entrySources.length === 0 && (
                    <Aviso tom="atencao" compacto className="mt-1">
                      Nenhuma origem marcada: nada entra sozinho neste funil. Você ainda pode
                      adicionar cards na mão.
                    </Aviso>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground pt-4">
                Lead que já tem card aqui não vira card novo: se a pessoa preencheu um formulário e
                depois mandou WhatsApp, a conversa é amarrada no card que já existe, na etapa em que ele está.
              </p>
            </div>}

            {aba === 'attributes' && <div className="py-4 overflow-y-auto flex-1">
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">{t('editPipeline.customAttributes')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('editPipeline.attributesDescription')}
                </p>
              </div>
              <PipelineCustomAttributes
                attributes={customAttributes}
                onAttributesChange={setCustomAttributes}
                disabled={loading}
                pipelineId={pipeline.id}
              />
            </div>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t('editPipeline.cancel')}
            </Button>
            <Button type="submit" disabled={loading || !formData.name?.trim() || (formData.visibility === 'team' && teamIds.length === 0)}>
              {loading ? t('editPipeline.saving') : t('editPipeline.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
