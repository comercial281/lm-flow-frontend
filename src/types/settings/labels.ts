import type { PaginatedResponse, StandardResponse, PaginationMeta } from '@/types/core';

export type LabelCategory =
  | 'own' | 'property' | 'followup' | 'sales_agent' | 'service' | 'deal_type' | 'lead_source';

export interface Label {
  id: string;
  title: string;
  display_name?: string;
  category?: LabelCategory;
  contacts_count?: number;
  description?: string;
  color: string;
  show_on_sidebar: boolean;
  created_at: string;
  updated_at: string;
}

export interface LabelFormData {
  title: string;
  description?: string;
  color: string;
  show_on_sidebar?: boolean;
}

export interface LabelsResponse extends PaginatedResponse<Label> {}

export interface LabelResponse extends StandardResponse<Label> {}

export interface LabelDeleteResponse extends StandardResponse<{ message: string }> {}

export interface LabelsState {
  labels: Label[];
  selectedLabelIds: string[];
  meta: {
    pagination: PaginationMeta;
  };
  loading: {
    list: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    bulk: boolean;
  };
  searchQuery: string;
  sortBy: 'title' | 'created_at';
  sortOrder: 'asc' | 'desc';
  loadError: boolean;
}
