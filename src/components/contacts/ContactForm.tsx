import React, { useState, useEffect } from 'react';
import { Button, Input, Label } from '@/components/ui/ds';
import { Contact, ContactFormData } from '@/types/contacts';
import { useAccountUsers } from '@/hooks/useAccountUsers';
import ContactLabels from './ContactLabels';
import CustomAttributes from './CustomAttributes';
import CampoResponsavel, { paraResponsavel } from './CampoResponsavel';
import type { EscolhaComAbas } from '@/components/base/SeletorComAbas';
import { labelsService } from '@/services/contacts';
import { Label as LabelType } from '@/types/settings';
import { useCorretorLogado } from '@/features/contatos/useCorretorLogado';

import { PhoneInput } from '@/components/shared/PhoneInput';
import { ManualOriginInput } from '@/components/shared/ManualOriginInput';
import { readManualOrigin } from '@/constants/manualLeadOrigin';
import '@/components/shared/PhoneInput.css';

interface ContactFormProps {
  contact?: Contact | null;
  isNew?: boolean;
  loading?: boolean;
  onSubmit: (data: ContactFormData) => void;
  onCancel?: () => void;
}

interface FormData {
  name: string;
  email: string;
  phoneNumber: string;
  labels: string[];
  leadOriginNote: string;
  responsavel: EscolhaComAbas | null;
}

const initialFormData: FormData = {
  name: '',
  email: '',
  phoneNumber: '',
  labels: [],
  leadOriginNote: '',
  responsavel: null,
};

// Cadastro enxuto (fase 4, decisão do dono em 02/10/2026): nome, celular,
// e-mail, responsável, origem e etiquetas. Saíram foto, tipo pessoa/empresa,
// sobrenome, CPF, país, cidade, empresa vinculada, descrição e redes sociais —
// herança de CRM genérico que imobiliária não usa. "Outras informações" só
// aparece se o gestor criou campo extra. O que já estava gravado nesses campos
// fica no contato: o formulário simplesmente não manda mais.
export default function ContactForm({
  contact,
  isNew = false,
  loading = false,
  onSubmit,
  onCancel,
}: ContactFormProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availableLabels, setAvailableLabels] = useState<LabelType[]>([]);
  const [customAttributes, setCustomAttributes] = useState<Record<string, unknown>>({});
  const [temCamposExtras, setTemCamposExtras] = useState(false);
  const { users: accountUsers } = useAccountUsers();
  const corretor = useCorretorLogado();

  useEffect(() => {
    labelsService
      .getLabels()
      .then(response => setAvailableLabels(response.data || []))
      .catch(error => console.error('Error loading labels:', error));
  }, []);

  useEffect(() => {
    if (contact && !isNew) {
      setFormData({
        name: contact.name || '',
        email: contact.email || '',
        phoneNumber: contact.phone_number || '',
        labels: contact.labels || [],
        leadOriginNote: readManualOrigin(contact.additional_attributes?.lead_origin),
        responsavel: contact.default_assignee_id
          ? { aba: 'corretor', valor: String(contact.default_assignee_id) }
          : null,
      });
      setCustomAttributes(contact.custom_attributes || {});
    } else {
      setFormData(initialFormData);
      setCustomAttributes({});
    }
  }, [contact, isNew]);

  const mudar = <K extends keyof FormData>(campo: K, valor: FormData[K]) => {
    setFormData(prev => ({ ...prev, [campo]: valor }));
    if (errors[campo]) setErrors(prev => ({ ...prev, [campo]: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Escreva o nome do cliente.';

    // Celular é o que faz o contato servir pra alguma coisa (WhatsApp, roleta).
    // Na edição não cobra: contato antigo sem número não pode travar o salvar.
    if (isNew && !formData.phoneNumber) {
      newErrors.phoneNumber = 'Escreva o celular do cliente.';
    } else if (formData.phoneNumber && !/^\+[1-9]\d{1,14}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Celular inválido. Confira o DDD e o número.';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'E-mail inválido.';
    }

    // Gestor cadastrando: contato nasce com dono ou indo pra roleta, nunca solto.
    if (isNew && !corretor && !formData.responsavel) {
      newErrors.responsavel = 'Escolha o corretor ou a roleta.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Corretor não manda responsável: o servidor grava ele mesmo como dono.
    const responsavel = corretor
      ? isNew ? {} : { default_assignee_id: contact?.default_assignee_id ?? null }
      : paraResponsavel(formData.responsavel);

    onSubmit({
      name: formData.name.trim(),
      type: contact?.type || 'person',
      email: formData.email.trim() || undefined,
      phone_number: formData.phoneNumber.trim() || undefined,
      labels: formData.labels,
      custom_attributes: customAttributes,
      lead_origin_note: formData.leadOriginNote.trim(),
      ...responsavel,
    });
  };

  // Nome, telefone e e-mail não mudam depois do cadastro (decisão do dono,
  // 02/10/2026). Telefone/e-mail só o gestor corrige, e só em lead cadastrado
  // à mão — quem diz é o servidor (`identity_correctable`), que confere de novo
  // ao salvar.
  const nomeTravado = !isNew;
  const contatoTravado = !isNew && !contact?.identity_correctable;

  // O dono atual aparece pro corretor que edita; no cadastro é ele mesmo.
  const corretorExibido = corretor
    ? isNew
      ? corretor
      : {
          id: String(contact?.default_assignee_id ?? ''),
          name: contact?.default_assignee?.name ?? 'Sem responsável',
        }
    : null;

  return (
    <form onSubmit={handleSubmit} className="flex max-h-[calc(90dvh-4.5rem)] flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {nomeTravado && (
          <p className="text-xs text-muted-foreground">
            {contatoTravado
              ? 'Nome, telefone e e-mail não mudam depois do cadastro.'
              : 'O nome não muda depois do cadastro. Telefone e e-mail: corrija só se foi erro de digitação.'}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contato-nome">
              Nome{isNew && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id="contato-nome"
              value={formData.name}
              onChange={e => mudar('name', e.target.value)}
              placeholder="Nome completo do cliente"
              disabled={loading || nomeTravado}
              aria-invalid={!!errors.name || undefined}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contato-celular">
              Celular{isNew && <span className="text-destructive"> *</span>}
            </Label>
            <PhoneInput
              value={formData.phoneNumber}
              onChange={value => mudar('phoneNumber', value)}
              placeholder="(11) 99999-9999"
              disabled={loading || contatoTravado}
              error={!!errors.phoneNumber}
              defaultCountry="BR"
            />
            {errors.phoneNumber && <p className="text-sm text-destructive">{errors.phoneNumber}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contato-email">E-mail</Label>
            <Input
              id="contato-email"
              type="email"
              value={formData.email}
              onChange={e => mudar('email', e.target.value)}
              placeholder="Opcional"
              disabled={loading || contatoTravado}
              aria-invalid={!!errors.email || undefined}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <CampoResponsavel
            corretor={corretorExibido}
            isNew={isNew}
            users={accountUsers}
            value={formData.responsavel}
            onChange={escolha => mudar('responsavel', escolha)}
            erro={errors.responsavel}
            disabled={loading}
          />
        </div>

        {/* Lead cadastrado na mão não tem anúncio pra rastrear: quem sabe de
            onde ele veio é quem está cadastrando. */}
        <ManualOriginInput
          id="contato-origem"
          label="Origem"
          soPilulas
          value={formData.leadOriginNote}
          onChange={value => mudar('leadOriginNote', value)}
          disabled={loading}
        />

        <div className="space-y-2">
          <Label>Etiquetas</Label>
          <ContactLabels
            contactId={contact?.id}
            labels={formData.labels}
            onLabelsChange={labels => mudar('labels', labels)}
            availableLabels={availableLabels}
            disabled={loading}
          />
        </div>

        {/* Montado sempre (é ele que lê os campos do gestor); aparece só se há algum. */}
        <div className={temCamposExtras ? 'space-y-2' : 'hidden'}>
          <Label>Outras informações</Label>
          <CustomAttributes
            attributes={customAttributes}
            onAttributesChange={setCustomAttributes}
            disabled={loading}
            soDefinidos
            aoCarregarDefinicoes={quantidade => setTemCamposExtras(quantidade > 0)}
          />
        </div>
      </div>

      {/* Rodapé fixo: o Salvar fica à vista sem rolar o formulário. */}
      <div className="flex justify-end gap-2 border-t border-border px-6 py-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : isNew ? 'Salvar contato' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
