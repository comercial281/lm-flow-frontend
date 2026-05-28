import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label as UILabel,
  Textarea,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@evoapi/design-system';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import BaseHeader from '@/components/base/BaseHeader';
import BaseTable from '@/components/base/BaseTable';
import type { TableColumn, TableAction } from '@/components/base/BaseTable';
import { productsService, Product } from '@/services/products/productsService';

const STATUS_LABELS: Record<Product['status'], string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  archived: 'Arquivado',
};

const STATUS_VARIANT: Record<Product['status'], 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  inactive: 'secondary',
  archived: 'destructive',
};

type FormData = Pick<Product, 'name' | 'description' | 'price' | 'sku' | 'status'>;

const EMPTY_FORM: FormData = {
  name: '',
  description: '',
  price: undefined,
  sku: '',
  status: 'active',
};

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await productsService.list();
      setProducts(data);
    } catch {
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      sku: product.sku ?? '',
      status: product.status,
    });
    setModalOpen(true);
  };

  const openDelete = (product: Product) => {
    setToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Nome do produto é obrigatório');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await productsService.update(editing.id, form);
        toast.success('Produto atualizado');
      } else {
        await productsService.create({ ...form, currency: 'BRL', variants: [], meta: {} });
        toast.success('Produto criado');
      }
      setModalOpen(false);
      load();
    } catch {
      toast.error(editing ? 'Erro ao atualizar produto' : 'Erro ao criar produto');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await productsService.delete(toDelete.id);
      toast.success('Produto removido');
      setDeleteDialogOpen(false);
      setToDelete(null);
      load();
    } catch {
      toast.error('Erro ao remover produto');
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Product>[] = [
    {
      key: 'name',
      label: 'Nome',
      sortable: true,
    },
    {
      key: 'sku',
      label: 'SKU',
      render: (p) => <span className="text-muted-foreground text-sm">{p.sku || '—'}</span>,
    },
    {
      key: 'price',
      label: 'Preco',
      render: (p) =>
        p.price != null ? (
          <span>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (p) => (
        <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABELS[p.status]}</Badge>
      ),
    },
  ];

  const actions: TableAction<Product>[] = [
    {
      label: 'Editar',
      icon: <Edit className="h-4 w-4" />,
      onClick: openEdit,
    },
    {
      label: 'Remover',
      icon: <Trash2 className="h-4 w-4" />,
      onClick: openDelete,
      variant: 'destructive',
    },
  ];

  return (
    <div className="h-full flex flex-col p-4">
      <BaseHeader
        title="Produtos"
        subtitle="Gerencie o catalogo de produtos da sua conta"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome ou SKU..."
        primaryAction={{
          label: 'Novo produto',
          icon: <Plus />,
          onClick: openCreate,
        }}
      />

      <div className="flex-1 overflow-auto mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-muted-foreground">Carregando...</div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum produto encontrado"
            description="Crie seu primeiro produto para comecar"
            action={{ label: 'Novo produto', onClick: openCreate }}
            className="h-full"
          />
        ) : (
          <BaseTable
            data={filtered}
            columns={columns}
            actions={actions}
            getRowKey={(p) => p.id}
            loading={loading}
          />
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) setModalOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar produto' : 'Novo produto'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Atualize os dados do produto.' : 'Preencha os dados do novo produto.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <UILabel htmlFor="product-name">Nome *</UILabel>
              <Input
                id="product-name"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nome do produto"
              />
            </div>

            <div className="space-y-1.5">
              <UILabel htmlFor="product-description">Descricao</UILabel>
              <Textarea
                id="product-description"
                value={form.description ?? ''}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descricao do produto"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <UILabel htmlFor="product-price">Preco (R$)</UILabel>
                <Input
                  id="product-price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price ?? ''}
                  onChange={(e) =>
                    setForm(f => ({ ...f, price: e.target.value ? parseFloat(e.target.value) : undefined }))
                  }
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-1.5">
                <UILabel htmlFor="product-sku">SKU</UILabel>
                <Input
                  id="product-sku"
                  value={form.sku ?? ''}
                  onChange={(e) => setForm(f => ({ ...f, sku: e.target.value }))}
                  placeholder="SKU-001"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <UILabel htmlFor="product-status">Status</UILabel>
              <Select
                value={form.status}
                onValueChange={(v) => setForm(f => ({ ...f, status: v as Product['status'] }))}
              >
                <SelectTrigger id="product-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover produto</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover <strong>{toDelete?.name}</strong>? Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
