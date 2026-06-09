import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@evoapi/design-system/card';
import { Zap, Loader2, Search, X } from 'lucide-react';
import { Button } from '@evoapi/design-system/button';
import type { QuickReply } from '@/types/knowledge';

interface QuickRepliesListProps {
  quickReplies: QuickReply[];
  isLoading?: boolean;
  onSelect: (reply: QuickReply) => void;
  onClose: () => void;
}

const QuickRepliesList: React.FC<QuickRepliesListProps> = ({
  quickReplies,
  isLoading = false,
  onSelect,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = search.trim()
    ? quickReplies.filter(
        r =>
          r.title.toLowerCase().includes(search.toLowerCase()) ||
          r.content.toLowerCase().includes(search.toLowerCase()),
      )
    : quickReplies;

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) onSelect(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const highlightMatch = (text: string) => {
    if (!search.trim()) return text;
    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === search.toLowerCase() ? (
            <mark key={i} className="bg-orange-200 dark:bg-orange-800 text-foreground">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </>
    );
  };

  return (
    <Card className="absolute bottom-full left-0 right-0 mb-2 shadow-lg border-border z-50 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Respostas Rápidas</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar por título ou conteúdo..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
            <Search className="h-8 w-8" />
            <p className="text-sm">Nenhuma resposta encontrada</p>
          </div>
        ) : (
          <div
            ref={listRef}
            className="max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted"
          >
            {filtered.map((reply, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={reply.id}
                  className={`px-4 py-3 cursor-pointer transition-all duration-150 border-b border-border last:border-b-0 ${
                    isSelected
                      ? 'bg-primary/10 border-l-4 border-l-primary'
                      : 'hover:bg-muted/50 border-l-4 border-l-transparent'
                  }`}
                  onClick={() => onSelect(reply)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}
                    >
                      {highlightMatch(reply.title)}
                    </span>
                    {reply.shared && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        compartilhado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {highlightMatch(
                      reply.content.length > 100
                        ? reply.content.substring(0, 100) + '...'
                        : reply.content,
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/20">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs">↑↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs">Enter</kbd>
              inserir
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs">Esc</kbd>
              fechar
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickRepliesList;
