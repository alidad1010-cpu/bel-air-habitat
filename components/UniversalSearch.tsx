import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Users, Handshake, Briefcase, HardHat, Building2, FileText, TrendingUp } from 'lucide-react';
import { Client, Employee, Project } from '../types';

interface UniversalSearchProps {
  clients: Client[];
  employees: Employee[];
  projects: Project[];
  onNavigate: (tab: string, id?: string) => void;
}

interface SearchResult {
  id: string;
  type: 'client' | 'employee' | 'project' | 'partner' | 'company';
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}

const UniversalSearch: React.FC<UniversalSearchProps> = ({
  clients,
  employees,
  projects,
  onNavigate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    clients.forEach((client) => {
      const matchName = client.name.toLowerCase().includes(lowerQuery);
      const matchEmail = client.email?.toLowerCase().includes(lowerQuery);
      const matchPhone = client.phone?.toLowerCase().includes(lowerQuery);

      if (matchName || matchEmail || matchPhone) {
        const isPartner = client.type === 'PARTENAIRE' || client.type === 'SOUS_TRAITANT';
        results.push({
          id: client.id || '',
          type: isPartner ? 'partner' : 'client',
          title: client.name,
          subtitle: client.email || client.phone || 'Aucun contact',
          icon: isPartner ? <Handshake size={20} /> : <Users size={20} />,
          color: isPartner ? 'text-amber-600' : 'text-emerald-600',
        });
      }
    });

    employees.forEach((employee) => {
      const fullName = `${employee.firstName} ${employee.lastName}`;
      const matchName = fullName.toLowerCase().includes(lowerQuery);
      const matchPosition = employee.position.toLowerCase().includes(lowerQuery);

      if (matchName || matchPosition) {
        results.push({
          id: employee.id,
          type: 'employee',
          title: fullName,
          subtitle: employee.position,
          icon: <HardHat size={20} />,
          color: 'text-purple-600',
        });
      }
    });

    projects.forEach((project) => {
      const matchName = project.title.toLowerCase().includes(lowerQuery);
      const matchClient = project.client?.name?.toLowerCase().includes(lowerQuery);

      if (matchName || matchClient) {
        results.push({
          id: project.id,
          type: 'project',
          title: project.title,
          subtitle: project.client?.name || 'Client inconnu',
          icon: <Briefcase size={20} />,
          color: 'text-blue-600',
        });
      }
    });

    return results.slice(0, 8);
  }, [query, clients, employees, projects]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter' && searchResults[selectedIndex]) {
      handleSelect(searchResults[selectedIndex]);
    }
  };

  const handleSelect = (result: SearchResult) => {
    const tabMap = {
      client: 'clients',
      partner: 'partners',
      employee: 'employees',
      project: 'projects',
      company: 'companies',
    };
    onNavigate(tabMap[result.type], result.id);
    setIsOpen(false);
    setQuery('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="hidden lg:flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-400 hover:border-emerald-500 transition-colors text-sm"
      >
        <Search size={16} />
        <span>Recherche rapide...</span>
        <kbd className="ml-auto px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={() => {
          setIsOpen(false);
          setQuery('');
        }}
      />
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4">
        <div className="glass-card rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-200 dark:border-slate-800">
            <Search size={20} className="text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher clients, salariés, projets..."
              className="flex-1 bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-400"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            )}
            <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono text-slate-600 dark:text-slate-400">
              ESC
            </kbd>
          </div>

          {query && searchResults.length > 0 && (
            <div className="max-h-96 overflow-y-auto">
              {searchResults.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                    index === selectedIndex ? 'bg-slate-50 dark:bg-slate-800/50' : ''
                  }`}
                >
                  <div className={`${result.color}`}>{result.icon}</div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {result.title}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {result.subtitle}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 uppercase font-semibold">
                    {result.type === 'client' && 'Client'}
                    {result.type === 'partner' && 'Partenaire'}
                    {result.type === 'employee' && 'Salarié'}
                    {result.type === 'project' && 'Projet'}
                    {result.type === 'company' && 'Entreprise'}
                  </div>
                </button>
              ))}
            </div>
          )}

          {query && searchResults.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-500">
              <Search size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Aucun résultat trouvé</p>
              <p className="text-sm mt-1">Essayez avec un autre terme de recherche</p>
            </div>
          )}

          {!query && (
            <div className="px-4 py-6 text-center text-slate-500">
              <TrendingUp size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Recherche rapide</p>
              <p className="text-sm mt-1">
                Tapez pour rechercher parmi vos clients, salariés et projets
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UniversalSearch;
