/**
 * FiltersPanel Component
 * UX: Panel de filtres coulissant depuis la droite pour économiser l'espace
 */
import React, { useState } from 'react';
import { X, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { ProjectStatus, ClientType } from '../types';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
  value: string | null;
  onChange: (value: string | null) => void;
}

interface FiltersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterGroup[];
  title?: string;
  onReset?: () => void;
  onApply?: () => void;
}

const FiltersPanel: React.FC<FiltersPanelProps> = ({
  isOpen,
  onClose,
  filters,
  title = 'Filtres',
  onReset,
  onApply,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(filters.map((f) => f.id))
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  const activeFiltersCount = filters.filter((f) => f.value !== null).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-screen w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-transform duration-300 ease-out animate-in slide-in-from-right">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <Filter size={20} className="text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                {title}
                {activeFiltersCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Fermer les filtres"
            >
              <X size={20} className="text-slate-600 dark:text-slate-400" />
            </button>
          </div>

          {/* Filters Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {filters.map((filter) => {
              const isExpanded = expandedGroups.has(filter.id);
              return (
                <div
                  key={filter.id}
                  className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleGroup(filter.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-800 dark:text-white">
                        {filter.label}
                      </span>
                      {filter.value && (
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-bold">
                          1
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={18} className="text-slate-500" />
                    ) : (
                      <ChevronDown size={18} className="text-slate-500" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-4 pt-0 space-y-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                      {/* All option */}
                      <label className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name={filter.id}
                          checked={filter.value === null}
                          onChange={() => filter.onChange(null)}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          Tous ({filter.options.reduce((sum, opt) => sum + (opt.count || 0), 0)})
                        </span>
                      </label>

                      {/* Filter options */}
                      {filter.options.map((option) => (
                        <label
                          key={option.value}
                          className="flex items-center justify-between space-x-3 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name={filter.id}
                              checked={filter.value === option.value}
                              onChange={() => filter.onChange(option.value)}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {option.label}
                            </span>
                          </div>
                          {option.count !== undefined && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                              {option.count}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
            {onReset && activeFiltersCount > 0 && (
              <button
                onClick={onReset}
                className="w-full px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
              >
                Réinitialiser
              </button>
            )}
            {onApply && (
              <button
                onClick={onApply}
                className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-lg transition-colors"
              >
                Appliquer
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default FiltersPanel;
