/**
 * ImprovedSearchResults Component
 * UX: Résultats de recherche mieux structurés avec compteurs et actions rapides
 */
import React from 'react';
import { Project, Client, Employee } from '../types';
import { Briefcase, Users, HardHat, ArrowRight, X } from 'lucide-react';

interface SearchResults {
  projects: Project[];
  clients: Client[];
  employees: Employee[];
}

interface ImprovedSearchResultsProps {
  results: SearchResults;
  query: string;
  onProjectClick: (project: Project) => void;
  onClientClick?: (client: Client) => void;
  onEmployeeClick?: (employee: Employee) => void;
  onClose: () => void;
}

const ImprovedSearchResults: React.FC<ImprovedSearchResultsProps> = ({
  results,
  query,
  onProjectClick,
  onClientClick,
  onEmployeeClick,
  onClose,
}) => {
  const totalResults = results.projects.length + results.clients.length + results.employees.length;

  if (totalResults === 0) {
    return (
      <div className="absolute top-full left-0 w-full bg-white dark:bg-slate-900 shadow-xl rounded-xl mt-2 border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
        <div className="p-8 text-center">
          <div className="text-slate-400 dark:text-slate-500 mb-2">
            <Briefcase size={32} className="mx-auto opacity-50" />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Aucun résultat pour <strong>"{query}"</strong>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
            Essayez avec d'autres mots-clés
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-full left-0 w-full bg-white dark:bg-slate-900 shadow-xl rounded-xl mt-2 border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[600px] overflow-y-auto z-50">
      {/* Header with total count */}
      <div className="sticky top-0 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
            {totalResults} résultat{totalResults > 1 ? 's' : ''} trouvé{totalResults > 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          aria-label="Fermer"
        >
          <X size={16} className="text-slate-500 dark:text-slate-400" />
        </button>
      </div>

      {/* Projects Section */}
      {results.projects.length > 0 && (
        <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
          <div className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50 flex items-center space-x-2">
            <Briefcase size={14} />
            <span>Dossiers ({results.projects.length})</span>
          </div>
          {results.projects.map((project) => (
            <button
              key={project.id}
              onClick={() => {
                onProjectClick(project);
                onClose();
              }}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-slate-800 dark:text-white flex items-center space-x-2 mb-1">
                    <span className="truncate">{project.title}</span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded flex-shrink-0">
                      #{project.id.slice(-6)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center space-x-2">
                    <Users size={12} />
                    <span>{project.client.name}</span>
                  </div>
                  {project.description && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {project.description}
                    </div>
                  )}
                </div>
                <ArrowRight
                  size={16}
                  className="ml-2 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0"
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Clients Section */}
      {results.clients.length > 0 && (
        <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
          <div className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50 flex items-center space-x-2">
            <Users size={14} />
            <span>Clients ({results.clients.length})</span>
          </div>
          {results.clients.map((client) => (
            <button
              key={client.id}
              onClick={() => {
                onClientClick?.(client);
                onClose();
              }}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-slate-800 dark:text-white mb-1">
                    {client.name}
                  </div>
                  {client.email && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {client.email}
                    </div>
                  )}
                  {client.phone && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {client.phone}
                    </div>
                  )}
                </div>
                <ArrowRight
                  size={16}
                  className="ml-2 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0"
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Employees Section */}
      {results.employees.length > 0 && (
        <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
          <div className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50 flex items-center space-x-2">
            <HardHat size={14} />
            <span>Salariés ({results.employees.length})</span>
          </div>
          {results.employees.map((employee) => (
            <button
              key={employee.id}
              onClick={() => {
                onEmployeeClick?.(employee);
                onClose();
              }}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-slate-800 dark:text-white mb-1">
                    {employee.firstName} {employee.lastName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {employee.position}
                  </div>
                  {employee.email && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {employee.email}
                    </div>
                  )}
                </div>
                <ArrowRight
                  size={16}
                  className="ml-2 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0"
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImprovedSearchResults;
