
import React from 'react';
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
        case ProjectStatus.NEW: return { label: 'NOUVEAU', class: 'bg-sky-100 text-sky-700 border-sky-200' };
        case ProjectStatus.IN_PROGRESS: return { label: 'EN COURS', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
        case ProjectStatus.QUOTE_SENT: return { label: 'DEVIS ENVOYÉ', class: 'bg-amber-100 text-amber-700 border-amber-200' };
        case ProjectStatus.VALIDATED: return { label: 'VALIDÉ', class: 'bg-violet-100 text-violet-700 border-violet-200' };
        case ProjectStatus.COMPLETED: return { label: 'TERMINÉ', class: 'bg-slate-200 text-slate-700 dark:text-slate-200 border-slate-300' };
        case ProjectStatus.CANCELLED: return { label: 'ANNULÉ', class: 'bg-red-100 text-red-700 border-red-200' };
        case ProjectStatus.LOST: return { label: 'PERDU', class: 'bg-rose-100 text-rose-700 border-rose-200' };
        case ProjectStatus.WAITING_VALIDATION: return { label: 'EN VALIDATION', class: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
        case ProjectStatus.REFUSED: return { label: 'REFUSÉ', class: 'bg-red-100 text-red-700 border-red-200' };
        default: return { label: status, class: 'bg-gray-100 text-gray-700 dark:text-gray-200' };
    }
};

const getRowColorClass = (status: ProjectStatus) => {
    if (status === ProjectStatus.NEW) return "bg-white dark:bg-slate-900/40 hover:bg-sky-50/50 dark:bg-slate-900/40 dark:hover:bg-slate-700/50";
    return "bg-white dark:bg-slate-900/40 hover:bg-slate-50/50 dark:bg-slate-900/40 dark:hover:bg-slate-700/50";
};

const ProjectList: React.FC<ProjectListProps> = ({ projects, onSelect, onDelete, onValidate, onSort, startIndex }) => {
    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-700 dark:text-slate-200 dark:text-white">
                <Filter size={32} className="mb-2 opacity-30" />
                <p>Aucun dossier trouvé.</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto overflow-x-auto glass-card rounded-xl border-none">
            <table className="w-full text-sm text-left border-collapse relative min-w-[800px] md:min-w-0">
                <thead className="text-xs text-slate-700 dark:text-slate-200 dark:text-white uppercase bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                        <th className="px-4 py-3 font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600" onClick={() => onSort('createdAt')}>Date d'ajout</th>
                        <th className="px-4 py-3 font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600" onClick={() => onSort('businessCode')}>Code Affaire</th>
                        <th className="px-4 py-3 font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors" onClick={() => onSort('client.name')}>Client</th>
                        <th className="px-4 py-3 font-bold hidden md:table-cell">Type</th>
                        <th className="px-4 py-3 font-bold hidden md:table-cell">Ville</th>
                        <th className="px-4 py-3 font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors" onClick={() => onSort('budget')}>Budget</th>
                        <th className="px-4 py-3 font-bold">Statut</th>
                        <th className="px-4 py-3 font-bold text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
                    {projects.map((project) => {
                        const statusStyle = getStatusLabel(project.status);
                        const rowClass = getRowColorClass(project.status);
                        const isUrgent = project.status === ProjectStatus.NEW && (Date.now() - project.createdAt) > 24 * 60 * 60 * 1000;
                        const isLate = project.endDate && new Date(project.endDate) < new Date() && project.status !== ProjectStatus.COMPLETED && project.status !== ProjectStatus.REFUSED && project.status !== ProjectStatus.LOST;

                        return (
                            <tr
                                key={project.id}
                                onClick={() => onSelect(project)}
                                className={`${rowClass} border-b border-white/50 cursor-pointer transition-all hover:brightness-95 content-visible`}
                            >
                                <td className="px-4 py-4 whitespace-nowrap text-slate-700 dark:text-slate-200 dark:text-white font-semibold">
                                    {new Date(project.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-4 font-mono text-xs text-slate-700 dark:text-slate-200 dark:text-white dark:text-white font-bold">
                                    {project.businessCode || project.id}
                                </td>
                                <td className="px-4 py-4 font-bold text-slate-900 dark:text-white dark:text-white dark:text-white text-base">
                                    {project.client.name}
                                    {isUrgent && <span title="Relance Email Requise"><Flame size={14} className="inline ml-2 text-red-500 animate-pulse" /></span>}
                                    {isLate && <span title="En retard"><AlertCircle size={14} className="inline ml-2 text-red-600" /></span>}
                                </td>
                                <td className="px-4 py-4 hidden md:table-cell">
                                    <span className="px-2 py-1 bg-white dark:bg-slate-900/50 dark:bg-black/20 rounded text-xs font-medium border border-black/5">
                                        {project.folderType || 'Particulier'}
                                    </span>
                                </td>
                                <td className="px-4 py-4 text-slate-700 dark:text-slate-200 dark:text-white truncate max-w-[200px] hidden md:table-cell">
                                    {project.client.city || project.client.address}
                                </td>
                                <td className="px-4 py-4 text-slate-800 dark:text-slate-100 dark:text-white font-bold">
                                    {project.budget ? project.budget.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) : '-'}
                                </td>
                                <td className="px-4 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wide border border-black/5 shadow-sm ${statusStyle.class}`}>
                                        {statusStyle.label}
                                    </span>
                                </td>
                                <td className="px-4 py-4 text-right flex items-center justify-end space-x-2">
                                    {project.status === ProjectStatus.QUOTE_SENT ? (
                                        <button
                                            onClick={(e) => onValidate(e, project.id)}
                                            className="inline-flex items-center px-3 py-1.5 bg-violet-600 text-slate-900 dark:text-white dark:text-white text-xs font-bold rounded shadow-md hover:scale-105 transition-transform"
                                        >
                                            <Check size={14} className="mr-1" /> OK
                                        </button>
                                    ) : (
                                        <div className="w-8"></div>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
                                        className="p-2 text-slate-700 dark:text-slate-200 dark:text-white hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default React.memo(ProjectList);
