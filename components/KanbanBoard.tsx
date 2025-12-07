
import React, { useState } from 'react';
import { Project, ProjectStatus } from '../types';
import { Calendar, Euro, MapPin, User, AlertCircle, Clock, Trash2, ChevronDown } from 'lucide-react';

interface KanbanBoardProps {
  projects: Project[];
  onProjectClick: (project: Project) => void;
  onProjectDelete?: (id: string) => void;
}

const COLUMN_CONFIG = [
  { 
      id: 'PROSPECT', 
      title: 'Nouveaux', 
      statuses: [ProjectStatus.NEW], 
      color: 'border-sky-500', 
      bgHeader: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
      bgBody: 'bg-sky-50/50 dark:bg-slate-900/50'
  },
  { 
      id: 'QUOTE', 
      title: 'Devis En Cours', 
      statuses: [ProjectStatus.QUOTE_SENT], 
      color: 'border-amber-500', 
      bgHeader: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      bgBody: 'bg-amber-50/50 dark:bg-slate-900/50'
  },
  { 
      id: 'VALIDATED', 
      title: 'Validé / À faire', 
      statuses: [ProjectStatus.VALIDATED], 
      color: 'border-violet-500', 
      bgHeader: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
      bgBody: 'bg-violet-50/50 dark:bg-slate-900/50'
  },
  { 
      id: 'IN_PROGRESS', 
      title: 'Chantier En Cours', 
      statuses: [ProjectStatus.IN_PROGRESS], 
      color: 'border-emerald-500', 
      bgHeader: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
      bgBody: 'bg-emerald-50/50 dark:bg-slate-900/50'
  },
  { 
      id: 'CLOSING', 
      title: 'Terminé / Facture', 
      statuses: [ProjectStatus.WAITING_VALIDATION, ProjectStatus.COMPLETED], 
      color: 'border-slate-500', 
      bgHeader: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 dark:text-white',
      bgBody: 'bg-slate-100/50 dark:bg-slate-900/50'
  },
];

// Memoized Card to prevent full re-renders when one item updates
const KanbanCard = React.memo(({ project, onClick, onDelete }: { project: Project, onClick: (p: Project) => void, onDelete?: (id: string) => void }) => {
    const isUrgent = (Date.now() - project.createdAt) > 24 * 60 * 60 * 1000 && project.status === ProjectStatus.NEW;
    const isLate = project.endDate && new Date(project.endDate) < new Date() && project.status !== ProjectStatus.COMPLETED;

    const formatBudget = (amount?: number) => {
        if (!amount) return '-';
        if (amount >= 1000) return (amount / 1000).toFixed(1) + 'k€';
        return amount + '€';
    };

    return (
        <div 
            onClick={() => onClick(project)}
            className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-emerald-500 dark:hover:border-emerald-500 cursor-pointer transition-all group relative animate-in zoom-in-95 duration-200 content-visible"
        >
            <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white font-bold">Code Affaire: {project.businessCode || '---'}</span>
                {project.priority === 'Haute' && (
                    <span className="w-2 h-2 rounded-full bg-red-500" title="Priorité Haute"></span>
                )}
            </div>
            
            <h4 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white text-sm mb-1 leading-snug group-hover:text-emerald-600 transition-colors pr-6 line-clamp-2">
                {project.title}
            </h4>
            
            {onDelete && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
                    className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Supprimer"
                >
                    <Trash2 size={14} />
                </button>
            )}
            
            <div className="flex items-center text-xs text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white mb-3">
                <User size={12} className="mr-1 shrink-0"/>
                <span className="truncate">{project.client.name}</span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                    {project.budget ? (
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {formatBudget(project.budget)}
                        </span>
                    ) : (
                        <span className="text-[10px] text-slate-300 italic">-- €</span>
                    )}
                </div>
                <div className="flex items-center space-x-1">
                    {isLate && <span title="En retard"><AlertCircle size={14} className="text-red-500" /></span>}
                    <div className="text-[10px] text-slate-700 dark:text-slate-200 dark:text-white">Ajouté le {new Date(project.createdAt).toLocaleDateString(undefined, {day: 'numeric', month: 'short'})}</div>
                </div>
            </div>
        </div>
    );
});

interface KanbanColumnProps {
    col: typeof COLUMN_CONFIG[0];
    projects: Project[];
    onProjectClick: (p: Project) => void;
    onProjectDelete?: (id: string) => void;
}

// Virtualized Column Component
const KanbanColumn: React.FC<KanbanColumnProps> = ({ col, projects, onProjectClick, onProjectDelete }) => {
    const [visibleCount, setVisibleCount] = useState(15);
    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const visibleProjects = projects.slice(0, visibleCount);
    const hasMore = projects.length > visibleCount;

    const formatBudget = (amount?: number) => {
        if (!amount) return '-';
        if (amount >= 1000) return (amount / 1000).toFixed(1) + 'k€';
        return amount + '€';
    };

    return (
        <div className={`flex-shrink-0 w-80 flex flex-col rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 ${col.bgBody} snap-center`}>
            {/* Column Header */}
            <div className={`p-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center ${col.bgHeader}`}>
                <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm">{col.title}</span>
                    <span className="bg-white dark:bg-slate-900/50 dark:bg-black/20 px-2 py-0.5 rounded-full text-xs font-bold">
                        {projects.length}
                    </span>
                </div>
                {totalBudget > 0 && (
                        <span className="text-xs font-mono font-bold opacity-80">
                        {formatBudget(totalBudget * 1000).replace('k', 'k')}
                        {totalBudget.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                        </span>
                )}
            </div>

            {/* Cards Container */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {visibleProjects.map(project => (
                    <KanbanCard 
                        key={project.id} 
                        project={project} 
                        onClick={onProjectClick} 
                        onDelete={onProjectDelete} 
                    />
                ))}
                
                {hasMore && (
                    <button 
                        onClick={() => setVisibleCount(prev => prev + 15)}
                        className="w-full py-2 text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900/50 hover:bg-white dark:bg-slate-900/80 dark:bg-slate-800/50 dark:hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors"
                    >
                        <ChevronDown size={14} className="mr-1"/> Voir la suite ({projects.length - visibleCount})
                    </button>
                )}

                {projects.length === 0 && (
                    <div className="h-20 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                        <span className="text-xs text-slate-700 dark:text-slate-200 dark:text-white font-medium">Vide</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const KanbanBoard: React.FC<KanbanBoardProps> = ({ projects, onProjectClick, onProjectDelete }) => {
  
  const getProjectsForColumn = (statuses: ProjectStatus[]) => {
    return projects
        .filter(p => statuses.includes(p.status))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  };

  return (
    <div className="flex h-full overflow-x-auto pb-4 px-4 space-x-4 min-w-full snap-x snap-mandatory">
        {COLUMN_CONFIG.map(col => (
            <KanbanColumn 
                key={col.id}
                col={col}
                projects={getProjectsForColumn(col.statuses)}
                onProjectClick={onProjectClick}
                onProjectDelete={onProjectDelete}
            />
        ))}
    </div>
  );
};

export default React.memo(KanbanBoard);
