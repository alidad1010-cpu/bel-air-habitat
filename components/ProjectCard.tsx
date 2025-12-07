

import React from 'react';
import { Phone, Mail, MapPin, Tag } from 'lucide-react';
import { Project, ProjectStatus } from '../types';

interface ProjectCardProps {
  project: Project;
  onMove?: (id: string, newStatus: ProjectStatus) => void;
  onClick: () => void;
}

const PRIORITY_COLORS = {
  'Haute': 'bg-red-100 text-red-700 border-red-200',
  'Moyenne': 'bg-orange-100 text-orange-700 border-orange-200',
  'Basse': 'bg-blue-100 text-blue-700 border-blue-200',
};

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-emerald-500 dark:hover:border-emerald-500 cursor-pointer transition-all group relative"
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white">Code Affaire: {project.businessCode || '---'}</span>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${PRIORITY_COLORS[project.priority] || PRIORITY_COLORS['Basse']}`}>
          {project.priority}
        </span>
      </div>

      <h3 className="font-semibold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white mb-1 leading-snug">{project.title}</h3>
      <p className="text-xs text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white mb-3 line-clamp-2">{project.description}</p>
      
      {/* TAGS */}
      {project.tags && project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
              {project.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 dark:text-white font-medium">
                      <Tag size={8} className="mr-1 opacity-50"/> {tag}
                  </span>
              ))}
              {project.tags.length > 3 && <span className="text-[10px] text-slate-700 dark:text-slate-200 dark:text-white">+{project.tags.length - 3}</span>}
          </div>
      )}

      <div className="space-y-1 mb-3">
        <div className="flex items-center text-xs text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white">
          <MapPin size={12} className="mr-2 text-indigo-400" />
          {/* Display Site Address (Construction Site) preferentially, fallback to Client Address */}
          <span className="truncate">{project.siteAddress || project.client.address || "Adresse non spécifiée"}</span>
        </div>
        <div className="flex items-center text-xs text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white">
            {project.contactMethod === 'EMAIL' ? <Mail size={12} className="mr-2 text-indigo-400"/> : <Phone size={12} className="mr-2 text-indigo-400"/>}
            <span>{project.contactMethod === 'EMAIL' ? 'Reçu par Email' : 'Reçu par Tél'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                {project.client.name.charAt(0)}
            </div>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 dark:text-white truncate max-w-[80px]">{project.client.name}</span>
        </div>
        <span className="text-[10px] text-slate-700 dark:text-slate-200 dark:text-white">
            Ajouté le {new Date(project.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </div>
  );
};

export default React.memo(ProjectCard);