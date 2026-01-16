import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { FixedSizeList } from 'react-window';
import { Filter, Check, Trash2, Flame, AlertCircle } from 'lucide-react';
import { Project, ProjectStatus } from '../types';

interface ProjectListProps {
  projects: Project[];
  onSelect: (project: Project) => void;
  onDelete: (id: string) => void;
  onValidate: (e: React.MouseEvent, id: string) => void;
  onSort: (field: string) => void;
  startIndex: number;
}

const getStatusLabel = (status: ProjectStatus) => {
  switch (status) {
    case ProjectStatus.NEW:
      return { label: 'NOUVEAU', class: 'bg-sky-100 text-sky-700 border-sky-200' };
    case ProjectStatus.IN_PROGRESS:
      return { label: 'EN COURS', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    case ProjectStatus.QUOTE_SENT:
      return { label: 'DEVIS ENVOYÉ', class: 'bg-amber-100 text-amber-700 border-amber-200' };
    case ProjectStatus.VALIDATED:
      return { label: 'VALIDÉ', class: 'bg-violet-100 text-violet-700 border-violet-200' };
    case ProjectStatus.COMPLETED:
      return {
        label: 'TERMINÉ',
        class: 'bg-slate-200 text-slate-700 dark:text-slate-200 border-slate-300',
      };
    case ProjectStatus.CANCELLED:
      return { label: 'ANNULÉ', class: 'bg-red-100 text-red-700 border-red-200' };
    case ProjectStatus.LOST:
      return { label: 'PERDU', class: 'bg-rose-100 text-rose-700 border-rose-200' };
    case ProjectStatus.WAITING_VALIDATION:
      return { label: 'EN VALIDATION', class: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    case ProjectStatus.REFUSED:
      return { label: 'REFUSÉ', class: 'bg-red-100 text-red-700 border-red-200' };
    default:
      return { label: status, class: 'bg-gray-100 text-gray-700 dark:text-gray-200' };
  }
};

const getRowColorClass = (status: ProjectStatus) => {
  if (status === ProjectStatus.NEW)
    return 'bg-white dark:bg-slate-900/40 hover:bg-sky-50 dark:hover:bg-slate-800/50';
  return 'bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/50';
};

const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  onSelect,
  onDelete,
  onValidate,
  onSort,
  startIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  const [containerWidth, setContainerWidth] = useState(800);

  // OPTIMIZATION: Calculer la hauteur et largeur du conteneur
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerHeight(Math.max(400, window.innerHeight - rect.top - 100));
      }
      // BUG FIX 3: Get actual width in pixels instead of using "100%"
      // FixedSizeList requires numeric width in pixels, not percentage
      if (listContainerRef.current) {
        const width = listContainerRef.current.getBoundingClientRect().width;
        setContainerWidth(Math.max(800, width));
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // OPTIMIZATION: Fonction de rendu des lignes mémorisée
  const renderRow = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const project = projects[index];
      if (!project) return null;

      const statusStyle = getStatusLabel(project.status);
      const rowClass = getRowColorClass(project.status);
      const isUrgent =
        project.status === ProjectStatus.NEW &&
        Date.now() - project.createdAt > 24 * 60 * 60 * 1000;
      const isLate =
        project.endDate &&
        new Date(project.endDate) < new Date() &&
        project.status !== ProjectStatus.COMPLETED &&
        project.status !== ProjectStatus.REFUSED &&
        project.status !== ProjectStatus.LOST;

      return (
        <div
          key={project.id}
          style={style}
          className={`${rowClass} border-b border-white/50 cursor-pointer transition-all hover:brightness-95 grid grid-cols-[120px_120px_200px_100px_150px_120px_140px_100px] min-w-[800px] md:min-w-0 items-center`}
          onClick={() => onSelect(project)}
        >
          <div className="px-4 py-4 whitespace-nowrap text-slate-700 dark:text-slate-200 dark:text-white font-semibold">
            {new Date(project.createdAt).toLocaleDateString()}
          </div>
          <div className="px-4 py-4 font-mono text-xs text-slate-700 dark:text-slate-200 dark:text-white font-bold">
            {project.businessCode || project.id}
          </div>
          <div className="px-4 py-4 font-bold text-slate-900 dark:text-white text-base">
            {project.client.name}
            {isUrgent && (
              <span title="Relance Email Requise">
                <Flame size={14} className="inline ml-2 text-red-500 animate-pulse" />
              </span>
            )}
            {isLate && (
              <span title="En retard">
                <AlertCircle size={14} className="inline ml-2 text-red-600" />
              </span>
            )}
          </div>
          <div className="px-4 py-4 hidden md:block">
            <span className="px-2 py-1 bg-white dark:bg-slate-900/50 rounded text-xs font-medium border border-black/5">
              {project.folderType || 'Particulier'}
            </span>
          </div>
          <div className="px-4 py-4 text-slate-700 dark:text-slate-200 dark:text-white truncate max-w-[200px] hidden md:block">
            {(() => {
              const rawAddr =
                project.siteAddress || project.client.city || project.client.address;
              if (!rawAddr) return '-';
              const match = rawAddr.match(/\d{5}\s+(.+)/);
              if (match && match[1]) return match[1].toUpperCase();
              return rawAddr.replace(/^.*,\s*/, '');
            })()}
          </div>
          <div className="px-4 py-4 text-slate-800 dark:text-slate-100 dark:text-white font-bold">
            {project.budget
              ? project.budget.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
              : '-'}
          </div>
          <div className="px-4 py-4">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wide border border-black/5 shadow-sm ${statusStyle.class}`}
            >
              {statusStyle.label}
            </span>
          </div>
          <div className="px-4 py-4 text-right flex items-center justify-end space-x-2">
            {project.status === ProjectStatus.QUOTE_SENT ? (
              <button
                onClick={(e) => onValidate(e, project.id)}
                className="inline-flex items-center px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded shadow-md hover:scale-105 transition-transform"
              >
                <Check size={14} className="mr-1" /> OK
              </button>
            ) : (
              <div className="w-8"></div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(project.id);
              }}
              className="p-2 text-slate-700 dark:text-slate-200 dark:text-white hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      );
    },
    [projects, onSelect, onDelete, onValidate]
  );

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-700 dark:text-slate-200 dark:text-white">
        <Filter size={32} className="mb-2 opacity-30" />
        <p>Aucun dossier trouvé.</p>
      </div>
    );
  }

  // OPTIMIZATION: Hauteur estimée par ligne (80px pour accommoder le contenu)
  const ROW_HEIGHT = 80;

  return (
    <div ref={containerRef} className="h-full overflow-x-auto glass-card rounded-xl border-none flex flex-col">
      {/* Header du tableau - sticky */}
      <div className="sticky top-0 z-10 bg-slate-50/50 dark:bg-slate-800/30 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 min-w-[800px]">
        <div className="grid grid-cols-[120px_120px_200px_100px_150px_120px_140px_100px] text-xs text-slate-700 dark:text-slate-200 dark:text-white uppercase">
          <div
            className="px-4 py-3 font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600"
            onClick={() => onSort('createdAt')}
          >
            Date d'ajout
          </div>
          <div
            className="px-4 py-3 font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600"
            onClick={() => onSort('businessCode')}
          >
            Code Affaire
          </div>
          <div
            className="px-4 py-3 font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
            onClick={() => onSort('client.name')}
          >
            Client
          </div>
          <div className="px-4 py-3 font-bold hidden md:block">Type</div>
          <div className="px-4 py-3 font-bold hidden md:block">Ville</div>
          <div
            className="px-4 py-3 font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
            onClick={() => onSort('budget')}
          >
            Budget
          </div>
          <div className="px-4 py-3 font-bold">Statut</div>
          <div className="px-4 py-3 font-bold text-right">Actions</div>
        </div>
      </div>

      {/* OPTIMIZATION: Virtualisation avec react-window pour améliorer les performances */}
      {/* BUG FIX 3: Use numeric width in pixels instead of "100%" */}
      <div ref={listContainerRef} className="flex-1 min-w-[800px]">
        <FixedSizeList
          height={containerHeight}
          itemCount={projects.length}
          itemSize={ROW_HEIGHT}
          width={containerWidth}
          overscanCount={5}
        >
          {renderRow}
        </FixedSizeList>
      </div>
    </div>
  );
};

export default React.memo(ProjectList);
