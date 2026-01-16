import React, { useState, useMemo, useCallback } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { validate, ClientSchema } from '../utils/validation';
import ErrorHandler, { ErrorType } from '../services/errorService';
import AddressAutocomplete from './AddressAutocomplete';
import {
  Search,
  Plus,
  Trash2,
  Mail,
  Phone,
  MapPin,
  User,
  Edit,
  Briefcase,
  Users,
  Handshake,
  Filter,
  ArrowUpDown,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

import { Client, Project, ClientType } from '../types';
import ClientDetailModal from './ClientDetailModal';

interface ClientsPageProps {
  clients: Client[];
  // We need projects to show history in the client card
  projects?: Project[];
  onAddClient: (client: Client) => void;
  onDeleteClient: (client: Client) => void;
  onUpdateClient?: (client: Client) => void;
  // Callback to open a project from the client detail view
  onNavigateToProject?: (project: Project) => void;
  onCreateProject?: (client: Client) => void;
  // NEW: Bulk Add Callback
  onBulkAddProjects?: (projects: Project[]) => void;
}

const ClientsPage: React.FC<ClientsPageProps> = ({
  clients,
  projects = [],
  onAddClient,
  onDeleteClient,
  onUpdateClient,
  onNavigateToProject,
  onCreateProject,
  onBulkAddProjects,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  // OPTIMIZATION: Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [typeFilter, setTypeFilter] = useState<ClientType | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'projects' | 'revenue'>('name');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Filter Tabs: 'ALL' | 'CLIENTS'
  const [newClient, setNewClient] = useState<Client>({
    name: '',
    email: '',
    phone: '',
    address: '',
    zipCode: '',
    city: '',
    type: 'PARTICULIER',
  });

  // Calculate client statistics (projects count and revenue)
  const clientStats = useMemo(() => {
    const stats = new Map<string, { projectsCount: number; revenue: number }>();
    projects.forEach((project) => {
      if (project.client?.id) {
        const existing = stats.get(project.client.id) || { projectsCount: 0, revenue: 0 };
        stats.set(project.client.id, {
          projectsCount: existing.projectsCount + 1,
          revenue: existing.revenue + (project.budget || 0),
        });
      }
    });
    return stats;
  }, [projects]);

  // OPTIMIZATION: Memoize filtered and sorted clients
  const filteredClients = useMemo(() => {
    const lowerQuery = debouncedSearchQuery.toLowerCase().trim();
    let filtered = clients
      .filter((c) => {
        const matchesSearch =
          c.name.toLowerCase().includes(lowerQuery) ||
          c.email?.toLowerCase().includes(lowerQuery) ||
          c.phone?.toLowerCase().includes(lowerQuery) ||
          c.city?.toLowerCase().includes(lowerQuery) ||
          c.zipCode?.toLowerCase().includes(lowerQuery);

        if (!matchesSearch) return false;

        // Type filter
        if (typeFilter !== 'ALL' && c.type !== typeFilter) return false;

        // ----------------------------------------------------------------------------------
        // FILTERING LOGIC
        // ----------------------------------------------------------------------------------

        // 1. Search overrides everything (allows finding a partner even if hidden)
        if (lowerQuery.length > 0) return true;

        // 2. Identify Partners/Subcontractors
        const isPartner = c.type === 'PARTENAIRE' || c.type === 'SOUS_TRAITANT';

        // 3. User Requirement: Strictly separate Partners from Clients Page
        // EXCEPTION: Always show "Coop", "Syndic", or "Cop" (Syndics often misclassified)
        const nameLower = (c.name || '').toLowerCase();
        const normalizedName = nameLower.replace(/[^a-z0-9]/g, '');
        if (
          nameLower.includes('coop') ||
          nameLower.includes('syndic') ||
          normalizedName.includes('coop') ||
          /\bcop\b/.test(nameLower) ||
          nameLower.includes('cop ')
        ) {
          return true;
        }

        // Hide Partners/Subcontractors from this page (they belong in PartnersPage)
        if (isPartner) return false;

        // 4. Default: Show everything else (BAILLEUR, SCI, PARTICULIER, ENTREPRISE, etc.)
        return true;
      });

    // Sort clients
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'projects') {
        const aStats = clientStats.get(a.id || '') || { projectsCount: 0, revenue: 0 };
        const bStats = clientStats.get(b.id || '') || { projectsCount: 0, revenue: 0 };
        return bStats.projectsCount - aStats.projectsCount;
      } else if (sortBy === 'revenue') {
        const aStats = clientStats.get(a.id || '') || { projectsCount: 0, revenue: 0 };
        const bStats = clientStats.get(b.id || '') || { projectsCount: 0, revenue: 0 };
        return bStats.revenue - aStats.revenue;
      }
      return 0;
    });

    return filtered;
  }, [clients, debouncedSearchQuery, typeFilter, sortBy, clientStats]);

  // Check for duplicate clients (by email or phone)
  const checkDuplicates = useCallback((client: Client) => {
    if (!client.email && !client.phone) return null;
    
    const duplicates = clients.filter((c) => {
      if (c.id === client.id) return false; // Skip self
      const emailMatch = client.email && c.email && client.email.toLowerCase() === c.email.toLowerCase();
      const phoneMatch = client.phone && c.phone && client.phone.replace(/\s/g, '') === c.phone.replace(/\s/g, '');
      return emailMatch || phoneMatch;
    });

    if (duplicates.length > 0) {
      return `Attention: Un client similaire existe déjà (${duplicates[0].name})`;
    }
    return null;
  }, [clients]);

  // OPTIMIZATION: Memoize callback to avoid recreating on every render
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate with Zod
    const validation = validate(ClientSchema, newClient);
    if (!validation.success) {
      ErrorHandler.handleAndShow(
        { message: validation.errors.join('\n'), type: ErrorType.VALIDATION },
        'ClientsPage - Add Client'
      );
      return;
    }

    // Check for duplicates
    const duplicateWarning = checkDuplicates(newClient);
    if (duplicateWarning) {
      setDuplicateWarning(duplicateWarning);
      // Still allow adding, but show warning
      setTimeout(() => setDuplicateWarning(null), 5000);
    }

    onAddClient(newClient);
    setIsModalOpen(false);
    setNewClient({
      name: '',
      email: '',
      phone: '',
      address: '',
      zipCode: '',
      city: '',
      type: 'PARTICULIER',
    });
    setDuplicateWarning(null);
  }, [newClient, onAddClient, checkDuplicates]);

  // Handle address autocomplete selection
  const handleAddressSelect = useCallback((result: { fullAddress: string; street: string; city: string; zipCode: string }) => {
    setNewClient((prev) => ({
      ...prev,
      address: result.street || result.fullAddress,
      city: result.city,
      zipCode: result.zipCode,
    }));
  }, []);

  // OPTIMIZATION: Memoize type label function
  const getTypeLabel = useCallback((type?: ClientType) => {
    switch (type) {
      case 'PARTICULIER':
        return { label: 'Particulier', class: 'bg-emerald-100 text-emerald-700' };
      case 'ENTREPRISE':
        return { label: 'Entreprise', class: 'bg-blue-100 text-blue-700' };
      case 'ARCHITECTE':
        return { label: 'Architecte', class: 'bg-indigo-100 text-indigo-700' };
      case 'SYNDIC':
        return { label: 'Syndic', class: 'bg-purple-100 text-purple-700' };
      case 'PARTENAIRE':
        return { label: 'Partenaire', class: 'bg-amber-100 text-amber-700' };
      case 'SOUS_TRAITANT':
        return { label: 'Sous-Traitant', class: 'bg-cyan-100 text-cyan-700' };
      case 'BAILLEUR':
        return { label: 'Bailleur', class: 'bg-orange-100 text-orange-700' };
      case 'SCI':
        return { label: 'SCI', class: 'bg-pink-100 text-pink-700' };
      default:
        return {
          label: 'Particulier',
          class: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200',
        };
    }
  }, []);

  const inputClass =
    'w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder-slate-400';
  const labelClass =
    'block text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase mb-1';

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">
          Base Clients ({filteredClients.length})
        </h2>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-700 dark:text-slate-200 dark:text-white"
              size={18}
            />
            <input
              type="text"
              name="client-search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-slate-900 dark:text-white"
            />
          </div>
          
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ClientType | 'ALL')}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="ALL">Tous les types</option>
            <option value="PARTICULIER">Particuliers</option>
            <option value="ENTREPRISE">Entreprises</option>
            <option value="ARCHITECTE">Architectes</option>
            <option value="SYNDIC">Syndics</option>
            <option value="BAILLEUR">Bailleurs</option>
            <option value="SCI">SCI</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'projects' | 'revenue')}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none flex items-center"
          >
            <option value="name">Tri: Nom</option>
            <option value="projects">Tri: Projets</option>
            <option value="revenue">Tri: CA</option>
          </select>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm whitespace-nowrap"
          >
            <Plus size={18} className="mr-2" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Clients List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.length > 0 ? (
          filteredClients.map((client, index) => {
            const typeStyle = getTypeLabel(client.type);
            const stats = clientStats.get(client.id || '') || { projectsCount: 0, revenue: 0 };
            return (
              <div
                key={client.id || index}
                onClick={() => setSelectedClient(client)}
                className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group relative cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg bg-emerald-100 text-emerald-700`}
                    >
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white leading-tight">
                        {client.name}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase mt-1 inline-block ${typeStyle.class}`}
                      >
                        {typeStyle.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                {stats.projectsCount > 0 && (
                  <div className="mb-3 flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Briefcase size={12} />
                      {stats.projectsCount} projet{stats.projectsCount > 1 ? 's' : ''}
                    </span>
                    {stats.revenue > 0 && (
                      <span className="flex items-center gap-1">
                        <TrendingUp size={12} />
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(stats.revenue)}
                      </span>
                    )}
                  </div>
                )}

                <div className="space-y-3 text-sm">
                  <div className="flex items-center text-slate-700 dark:text-slate-200 dark:text-white">
                    <Mail
                      size={16}
                      className="mr-3 text-slate-700 dark:text-slate-200 dark:text-white"
                    />
                    <span className="truncate">{client.email || 'Non renseigné'}</span>
                  </div>
                  <div className="flex items-center text-slate-700 dark:text-slate-200 dark:text-white">
                    <Phone
                      size={16}
                      className="mr-3 text-slate-700 dark:text-slate-200 dark:text-white"
                    />
                    <span>{client.phone || 'Non renseigné'}</span>
                  </div>
                  <div className="flex items-start text-slate-700 dark:text-slate-200 dark:text-white">
                    <MapPin
                      size={16}
                      className="mr-3 text-slate-700 dark:text-slate-200 dark:text-white mt-0.5"
                    />
                    <span className="line-clamp-2">
                      {client.address}
                      {client.zipCode || client.city ? `, ${client.zipCode} ${client.city}` : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center h-64 text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            <User size={48} className="mb-4 opacity-50" />
            <p>Aucun contact trouvé dans cette catégorie</p>
          </div>
        )}
      </div>

      {/* Add Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">
                Nouveau Contact
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 dark:hover:text-slate-200"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className={labelClass}>Type de Contact</label>
                <select
                  value={newClient.type}
                  onChange={(e) =>
                    setNewClient({ ...newClient, type: e.target.value as ClientType })
                  }
                  className={inputClass}
                >
                  <option value="PARTICULIER">Particulier (Client)</option>
                  <option value="ENTREPRISE">Entreprise (Client)</option>
                  <option value="SCI">SCI (Société Civile Immobilière)</option>
                  <option value="BAILLEUR">Bailleur Social / Privé</option>
                  <option value="ARCHITECTE">Architecte (Apporteur)</option>
                  <option value="SYNDIC">Syndic de Copro</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Nom Complet / Raison Sociale</label>
                <input
                  required
                  type="text"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Téléphone</label>
                  <input
                    type="tel"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Adresse</label>
                <AddressAutocomplete
                  value={newClient.address}
                  onChange={(val) => setNewClient({ ...newClient, address: val })}
                  onSelect={handleAddressSelect}
                  placeholder="Saisir une adresse..."
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className={labelClass}>Code Postal</label>
                  <input
                    type="text"
                    value={newClient.zipCode}
                    onChange={(e) => setNewClient({ ...newClient, zipCode: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Ville</label>
                  <input
                    type="text"
                    value={newClient.city}
                    onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Duplicate Warning */}
              {duplicateWarning && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{duplicateWarning}</span>
                </div>
              )}

              <div className="flex justify-end pt-4 space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-200 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium shadow-lg shadow-emerald-200 dark:shadow-none"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Detail Modal */}
      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          projects={projects}
          isOpen={!!selectedClient}
          onClose={() => setSelectedClient(null)}
          onDelete={() => {
            onDeleteClient(selectedClient);
            setSelectedClient(null);
          }}
          onUpdate={(updated) => {
            if (onUpdateClient) onUpdateClient(updated);
            setSelectedClient(updated);
          }}
          onProjectClick={(p) => {
            if (onNavigateToProject) {
              setSelectedClient(null);
              onNavigateToProject(p);
            }
          }}
          onCreateProject={(c) => {
            if (onCreateProject) {
              onCreateProject(c);
              setSelectedClient(null); // Close modal
            }
          }}
          onBulkAdd={(projs) => {
            if (onBulkAddProjects) {
              onBulkAddProjects(projs);
              // We keep the modal open to show the new projects in history
            }
          }}
        />
      )}
    </div>
  );
};

// OPTIMIZATION: Memoize component to prevent unnecessary re-renders
export default React.memo(ClientsPage);
