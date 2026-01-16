/**
 * MultiSelect Hook & Utilities
 * UX: Permet la sélection multiple pour actions groupées
 */
import { useState, useCallback, useMemo } from 'react';

export interface UseMultiSelectOptions<T> {
  items: T[];
  getItemId: (item: T) => string | number;
  initialSelection?: string[];
}

export interface UseMultiSelectReturn<T> {
  selectedIds: Set<string | number>;
  isSelected: (item: T) => boolean;
  toggleSelection: (item: T) => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectItems: (items: T[]) => void;
  selectedItems: T[];
  selectedCount: number;
}

/**
 * Hook pour gérer la sélection multiple
 */
export function useMultiSelect<T>({
  items,
  getItemId,
  initialSelection = [],
}: UseMultiSelectOptions<T>): UseMultiSelectReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(
    new Set(initialSelection)
  );

  const isSelected = useCallback(
    (item: T) => {
      const id = getItemId(item);
      return selectedIds.has(id);
    },
    [selectedIds, getItemId]
  );

  const toggleSelection = useCallback(
    (item: T) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const id = getItemId(item);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [getItemId]
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((item) => getItemId(item))));
  }, [items, getItemId]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectItems = useCallback(
    (itemsToSelect: T[]) => {
      setSelectedIds(new Set(itemsToSelect.map((item) => getItemId(item))));
    },
    [getItemId]
  );

  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedIds.has(getItemId(item)));
  }, [items, selectedIds, getItemId]);

  return {
    selectedIds,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    selectItems,
    selectedItems,
    selectedCount: selectedIds.size,
  };
}

/**
 * Composant Checkbox pour sélection multiple
 */
interface MultiSelectCheckboxProps {
  checked: boolean;
  onChange: () => void;
  label?: string;
  className?: string;
}

export const MultiSelectCheckbox: React.FC<MultiSelectCheckboxProps> = ({
  checked,
  onChange,
  label,
  className = '',
}) => {
  return (
    <label className={`flex items-center space-x-2 cursor-pointer ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 rounded border-slate-300 dark:border-slate-600"
        onClick={(e) => e.stopPropagation()}
      />
      {label && <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>}
    </label>
  );
};

/**
 * Barre d'actions pour les éléments sélectionnés
 */
interface SelectionActionsBarProps<T> {
  selectedCount: number;
  onClear: () => void;
  onSelectAll: () => void;
  actions?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'danger';
  }>;
}

export function SelectionActionsBar<T>({
  selectedCount,
  onClear,
  onSelectAll,
  actions = [],
}: SelectionActionsBarProps<T>) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-20 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800 px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-4">
        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
          {selectedCount} élément{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
        </span>
        <button
          onClick={onSelectAll}
          className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          Tout sélectionner
        </button>
        <button
          onClick={onClear}
          className="text-xs text-slate-600 dark:text-slate-400 hover:underline"
        >
          Tout désélectionner
        </button>
      </div>
      <div className="flex items-center space-x-2">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              action.variant === 'danger'
                ? 'bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
            }`}
          >
            {action.icon && <span className="mr-1.5">{action.icon}</span>}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
