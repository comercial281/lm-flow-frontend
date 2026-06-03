// Sidebar de categorias — arvore (parent_id) + CRUD basico (super-admin).
// Estado: categoria selecionada via props (controlada pela pagina).
// Tokens visuais adaptados ao design system do LM Flow (border, muted-foreground, primary).

import { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  Plus,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  type KnowledgeCategory,
} from '@/hooks/useKnowledge';

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  canEdit: boolean;
}

interface TreeNode extends KnowledgeCategory {
  children: TreeNode[];
}

function buildTree(items: KnowledgeCategory[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  items.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export default function CategoriaSidebar({ selectedId, onSelect, canEdit }: Props) {
  const { data: cats = [], isLoading } = useCategories();
  const createMut = useCreateCategory();
  const updateMut = useUpdateCategory();
  const deleteMut = useDeleteCategory();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creatingParent, setCreatingParent] = useState<string | null | undefined>(undefined);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(cats), [cats]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    await createMut.mutateAsync({ nome: newName.trim(), parent_id: creatingParent ?? null });
    setNewName('');
    setCreatingParent(undefined);
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return;
    await updateMut.mutateAsync({ id, nome: editName.trim() });
    setEditingId(null);
  }

  function renderNode(node: TreeNode, depth: number) {
    const isOpen = expanded.has(node.id);
    const isSelected = selectedId === node.id;
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id}>
        <div
          className={`group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
            isSelected ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-muted/60'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => onSelect(node.id)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggle(node.id);
              }}
              className="p-0.5 text-muted-foreground hover:text-foreground"
              type="button"
            >
              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : (
            <span className="w-4" />
          )}
          {isOpen ? <FolderOpen size={14} /> : <Folder size={14} />}
          {editingId === node.id ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleRename(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(node.id);
                if (e.key === 'Escape') setEditingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-xs"
            />
          ) : (
            <span className="flex-1 text-xs truncate">{node.nome}</span>
          )}
          {canEdit && editingId !== node.id && (
            <div className="relative opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(menuOpen === node.id ? null : node.id);
                }}
                className="p-0.5 text-muted-foreground hover:text-foreground"
              >
                <MoreVertical size={12} />
              </button>
              {menuOpen === node.id && (
                <div
                  className="absolute right-0 top-5 z-20 bg-card border border-border rounded-lg shadow-xl min-w-[140px] py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setEditingId(node.id);
                      setEditName(node.nome);
                      setMenuOpen(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted text-left"
                  >
                    <Pencil size={11} /> Renomear
                  </button>
                  <button
                    onClick={() => {
                      setCreatingParent(node.id);
                      setMenuOpen(null);
                      setExpanded((p) => new Set(p).add(node.id));
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted text-left"
                  >
                    <Plus size={11} /> Subcategoria
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Excluir "${node.nome}"? Apenas categorias vazias podem ser removidas.`,
                        )
                      ) {
                        deleteMut.mutate(node.id);
                      }
                      setMenuOpen(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 text-left"
                  >
                    <Trash2 size={11} /> Excluir
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {creatingParent === node.id && (
          <div style={{ paddingLeft: `${(depth + 1) * 12 + 24}px` }} className="py-1 pr-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome da subcategoria"
              onBlur={handleCreate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') {
                  setNewName('');
                  setCreatingParent(undefined);
                }
              }}
              className="w-full bg-background border border-border rounded px-2 py-1 text-xs"
            />
          </div>
        )}
        {isOpen && node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-muted/30 flex flex-col">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Categorias
        </span>
        {canEdit && (
          <button
            onClick={() => {
              setCreatingParent(null);
              setNewName('');
            }}
            className="p-1 text-muted-foreground hover:text-primary rounded transition-colors"
            title="Nova categoria"
            type="button"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {isLoading && <p className="px-3 py-2 text-xs text-muted-foreground">Carregando...</p>}
        {!isLoading && tree.length === 0 && creatingParent !== null && (
          <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma categoria ainda.</p>
        )}
        {creatingParent === null && (
          <div className="px-2 py-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nova categoria"
              onBlur={handleCreate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') {
                  setNewName('');
                  setCreatingParent(undefined);
                }
              }}
              className="w-full bg-background border border-border rounded px-2 py-1 text-xs"
            />
          </div>
        )}
        {tree.map((node) => renderNode(node, 0))}
      </div>
    </aside>
  );
}
