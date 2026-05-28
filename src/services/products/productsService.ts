import api from '@/services/core/api';

export interface Product {
  id: number;
  name: string;
  description?: string;
  price?: number;
  currency: string;
  sku?: string;
  status: 'active' | 'inactive' | 'archived';
  variants: unknown[];
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const productsService = {
  async list(params?: { status?: string; q?: string }): Promise<Product[]> {
    const response = await api.get('/products', { params });
    return response.data;
  },
  async create(data: Partial<Product>): Promise<Product> {
    const response = await api.post('/products', { product: data });
    return response.data;
  },
  async update(id: number, data: Partial<Product>): Promise<Product> {
    const response = await api.put(`/products/${id}`, { product: data });
    return response.data;
  },
  async delete(id: number): Promise<void> {
    await api.delete(`/products/${id}`);
  },
};
