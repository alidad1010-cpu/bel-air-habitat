/**
 * CustomizableDashboard Component
 * UX: Permet de réorganiser les widgets du Dashboard par drag & drop
 */
import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, Settings2, RotateCcw } from 'lucide-react';
import { Project } from '../types';

export type WidgetType = 
  | 'workflow-incoming'
  | 'workflow-production'
  | 'workflow-closing'
  | 'charts'
  | 'global-stats';

export interface WidgetConfig {
  id: WidgetType;
  visible: boolean;
  order: number;
}

interface CustomizableDashboardProps {
  widgets: React.ReactNode[];
  widgetConfigs: WidgetConfig[];
  onReorder: (widgets: WidgetConfig[]) => void;
  isCustomizing?: boolean;
  onToggleCustomize?: () => void;
}

export const CustomizableDashboard: React.FC<CustomizableDashboardProps> = ({
  widgets,
  widgetConfigs,
  onReorder,
  isCustomizing = false,
  onToggleCustomize,
}) => {
  const [localConfigs, setLocalConfigs] = useState<WidgetConfig[]>(widgetConfigs);

  // Sync local configs when props change
  useEffect(() => {
    setLocalConfigs(widgetConfigs);
  }, [widgetConfigs]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source } = result;

    if (!destination || !isCustomizing) return;
    if (destination.index === source.index) return;

    const newConfigs = Array.from(localConfigs);
    const [removed] = newConfigs.splice(source.index, 1);
    newConfigs.splice(destination.index, 0, removed);

    // Update order values
    const updatedConfigs = newConfigs.map((config, index) => ({
      ...config,
      order: index,
    }));

    setLocalConfigs(updatedConfigs);
    onReorder(updatedConfigs);
  };

  const toggleWidgetVisibility = (widgetId: WidgetType) => {
    const updatedConfigs = localConfigs.map((config) =>
      config.id === widgetId ? { ...config, visible: !config.visible } : config
    );
    setLocalConfigs(updatedConfigs);
    onReorder(updatedConfigs);
  };

  const resetToDefault = () => {
    const defaultConfigs = widgetConfigs.map((config, index) => ({
      ...config,
      order: index,
      visible: true,
    }));
    setLocalConfigs(defaultConfigs);
    onReorder(defaultConfigs);
  };

  // Sort widgets by order and filter visible
  const sortedVisibleWidgets = useMemo(() => {
    const sorted = [...localConfigs]
      .sort((a, b) => a.order - b.order)
      .filter((config) => config.visible);

    return sorted.map((config) => {
      const widgetIndex = widgetConfigs.findIndex((wc) => wc.id === config.id);
      return {
        config,
        widget: widgets[widgetIndex],
        originalIndex: widgetIndex,
      };
    });
  }, [localConfigs, widgets, widgetConfigs]);

  if (!isCustomizing) {
    // Normal mode: just render widgets
    return (
      <div className="space-y-12">
        {sortedVisibleWidgets.map(({ config, widget }) => (
          <div key={config.id}>{widget}</div>
        ))}
      </div>
    );
  }

  // Customization mode: show all widgets with drag handles
  const allWidgetsSorted = [...localConfigs]
    .sort((a, b) => a.order - b.order)
    .map((config) => {
      const widgetIndex = widgetConfigs.findIndex((wc) => wc.id === config.id);
      return {
        config,
        widget: widgets[widgetIndex],
      };
    });

  return (
    <div className="space-y-6">
      {/* Customization Header */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Settings2 size={20} className="text-emerald-600 dark:text-emerald-400" />
          <div>
            <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
              Mode Personnalisation
            </h3>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Glissez-déposez pour réorganiser, cliquez pour masquer/afficher
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={resetToDefault}
            className="px-3 py-1.5 text-sm text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors flex items-center space-x-1"
          >
            <RotateCcw size={14} />
            <span>Réinitialiser</span>
          </button>
          {onToggleCustomize && (
            <button
              onClick={onToggleCustomize}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
            >
              Terminer
            </button>
          )}
        </div>
      </div>

      {/* Draggable Widgets */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="dashboard-widgets">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-4"
            >
              {allWidgetsSorted.map(({ config, widget }, index) => (
                <Draggable key={config.id} draggableId={config.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`bg-white dark:bg-slate-900 rounded-xl border-2 transition-all ${
                        snapshot.isDragging
                          ? 'border-emerald-500 shadow-2xl ring-2 ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700'
                      } ${!config.visible ? 'opacity-50' : ''}`}
                    >
                      {/* Widget Header with Drag Handle */}
                      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                          >
                            <GripVertical size={20} />
                          </div>
                          <span className="font-semibold text-slate-800 dark:text-white">
                            {config.id === 'workflow-incoming' && '1. Flux Entrant'}
                            {config.id === 'workflow-production' && '2. Production'}
                            {config.id === 'workflow-closing' && '3. Clôture'}
                            {config.id === 'charts' && 'Analyses & Statistiques'}
                            {config.id === 'global-stats' && 'Statistiques Globales'}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleWidgetVisibility(config.id)}
                          className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                            config.visible
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {config.visible ? 'Visible' : 'Masqué'}
                        </button>
                      </div>

                      {/* Widget Content */}
                      <div className={`p-4 ${!config.visible ? 'pointer-events-none' : ''}`}>
                        {widget}
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

/**
 * Hook pour gérer la configuration du Dashboard
 */
export function useDashboardConfig(userId?: string) {
  const storageKey = userId ? `dashboard-config-${userId}` : 'dashboard-config';

  const defaultConfigs: WidgetConfig[] = [
    { id: 'workflow-incoming', visible: true, order: 0 },
    { id: 'workflow-production', visible: true, order: 1 },
    { id: 'workflow-closing', visible: true, order: 2 },
    { id: 'charts', visible: true, order: 3 },
    { id: 'global-stats', visible: true, order: 4 },
  ];

  const [configs, setConfigs] = useState<WidgetConfig[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load dashboard config', e);
    }
    return defaultConfigs;
  });

  const saveConfig = (newConfigs: WidgetConfig[]) => {
    setConfigs(newConfigs);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newConfigs));
    } catch (e) {
      console.warn('Failed to save dashboard config', e);
    }
  };

  const resetConfig = () => {
    saveConfig(defaultConfigs);
  };

  return {
    configs,
    saveConfig,
    resetConfig,
  };
}
