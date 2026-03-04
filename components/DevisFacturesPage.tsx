import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter,
  Download,
  Send,
  Eye,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Euro,
  Calendar,
  User,
  Building,
  AlertCircle,
  FileCheck,
  Receipt
} from 'lucide-react';
import {
  Devis,
  DevisStatus,
  Facture,
  FactureStatus,
  FactureType,
  Client
} from '../types';
import {
  getAllDevis,
  getAllFactures,
  getCompanyInvoiceSettings
} from '../services/invoiceService';

interface DevisFacturesPageProps {
  clients: Client[];
  currentUser: any;
}

type TabType = 'devis' | 'factures';
type FilterType = 'all' | 'brouillon' | 'envoye' | 'accepte' | 'payee' | 'en_attente';

const DevisFacturesPage: React.FC<DevisFacturesPageProps> = ({ clients, currentUser }) => {
  const [activeTab, setActiveTab] = useState<TabType>('devis');
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [facturesList, setFacturesList] = useState<Facture[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [devis, factures] = await Promise.all([
        getAllDevis(),
        getAllFactures()
      ]);
      setDevisList(devis);
      setFacturesList(factures);
    } catch (error) {
      console.error('Error loading devis/factures:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDevis = useMemo(() => {
    return devisList.filter(devis => {
      const matchesSearch = 
        devis.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        devis.clientName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = 
        filterStatus === 'all' ||
        (filterStatus === 'brouillon' && devis.status === DevisStatus.DRAFT) ||
        (filterStatus === 'envoye' && devis.status === DevisStatus.SENT) ||
        (filterStatus === 'accepte' && devis.status === DevisStatus.ACCEPTED);
      
      return matchesSearch && matchesFilter;
    });
  }, [devisList, searchTerm, filterStatus]);

  const filteredFactures = useMemo(() => {
    return facturesList.filter(facture => {
      const matchesSearch = 
        facture.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        facture.clientName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = 
        filterStatus === 'all' ||
        (filterStatus === 'brouillon' && facture.status === FactureStatus.DRAFT) ||
        (filterStatus === 'payee' && facture.status === FactureStatus.PAID) ||
        (filterStatus === 'en_attente' && facture.status === FactureStatus.SENT);
      
      return matchesSearch && matchesFilter;
    });
  }, [facturesList, searchTerm, filterStatus]);

  const getDevisStatusBadge = (status: DevisStatus) => {
    const badges: Record<string, { label: string; class: string }> = {
      [DevisStatus.DRAFT]: { label: 'Brouillon', class: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
      [DevisStatus.SENT]: { label: 'Envoyé', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' },
      [DevisStatus.ACCEPTED]: { label: 'Accepté', class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200' },
      [DevisStatus.REFUSED]: { label: 'Refusé', class: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' },
      [DevisStatus.EXPIRED]: { label: 'Expiré', class: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200' },
    };
    const badge = badges[status] || { label: status, class: 'bg-slate-100 text-slate-700' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.class}`}>
        {badge.label}
      </span>
    );
  };

  const getFactureStatusBadge = (status: FactureStatus) => {
    const badges: Record<string, { label: string; class: string }> = {
      [FactureStatus.DRAFT]: { label: 'Brouillon', class: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
      [FactureStatus.SENT]: { label: 'Envoyée', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' },
      [FactureStatus.PAID]: { label: 'Payée', class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200' },
      [FactureStatus.PARTIAL]: { label: 'Payée partiellement', class: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200' },
      [FactureStatus.OVERDUE]: { label: 'En retard', class: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' },
      [FactureStatus.CANCELLED]: { label: 'Annulée', class: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
    };
    const badge = badges[status] || { label: status, class: 'bg-slate-100 text-slate-700' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.class}`}>
        {badge.label}
      </span>
    );
  };

  const getFactureTypeLabel = (type: FactureType) => {
    const labels: Record<string, string> = {
      [FactureType.INVOICE]: 'Facture',
      [FactureType.ADVANCE]: 'Facture d\'acompte',
      [FactureType.CREDIT_NOTE]: 'Avoir',
    };
    return labels[type] || type;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const stats = useMemo(() => {
    if (activeTab === 'devis') {
      return {
        total: devisList.length,
        brouillon: devisList.filter(d => d.status === DevisStatus.DRAFT).length,
        envoye: devisList.filter(d => d.status === DevisStatus.SENT).length,
        accepte: devisList.filter(d => d.status === DevisStatus.ACCEPTED).length,
        montantTotal: devisList
          .filter(d => d.status === DevisStatus.ACCEPTED)
          .reduce((sum, d) => sum + d.totalTTC, 0)
      };
    } else {
      return {
        total: facturesList.length,
        brouillon: facturesList.filter(f => f.status === FactureStatus.DRAFT).length,
        enAttente: facturesList.filter(f => f.status === FactureStatus.SENT).length,
        payee: facturesList.filter(f => f.status === FactureStatus.PAID).length,
        montantTotal: facturesList
          .filter(f => f.status === FactureStatus.PAID)
          .reduce((sum, f) => sum + f.totalTTC, 0),
        montantEnAttente: facturesList
          .filter(f => f.status === FactureStatus.SENT)
          .reduce((sum, f) => sum + f.remainingAmount, 0)
      };
    }
  }, [activeTab, devisList, facturesList]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            Devis & Factures
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Gestion conforme à la réglementation française (Loi anti-fraude TVA 2018)
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nouveau {activeTab === 'devis' ? 'Devis' : 'Facture'}
        </button>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('devis')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'devis'
              ? 'text-primary border-b-2 border-primary'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Devis
            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full text-xs">
              {devisList.length}
            </span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('factures')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'factures'
              ? 'text-primary border-b-2 border-primary'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Factures
            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full text-xs">
              {facturesList.length}
            </span>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {activeTab === 'devis' ? (
          <>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Devis</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                </div>
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Brouillons</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.brouillon}</p>
                </div>
                <Edit2 className="w-8 h-8 text-slate-400" />
              </div>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Envoyés</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.envoye}</p>
                </div>
                <Send className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Acceptés</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.accepte}</p>
                  <p className="text-xs text-slate-500 mt-1">{formatCurrency(stats.montantTotal)}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Factures</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                </div>
                <Receipt className="w-8 h-8 text-slate-400" />
              </div>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">En attente</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.enAttente}</p>
                  <p className="text-xs text-slate-500 mt-1">{formatCurrency(stats.montantEnAttente || 0)}</p>
                </div>
                <Clock className="w-8 h-8 text-amber-400" />
              </div>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Payées</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.payee}</p>
                  <p className="text-xs text-slate-500 mt-1">{formatCurrency(stats.montantTotal)}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Brouillons</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.brouillon}</p>
                </div>
                <Edit2 className="w-8 h-8 text-slate-400" />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder={`Rechercher un ${activeTab === 'devis' ? 'devis' : 'facture'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterType)}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="all">Tous les statuts</option>
            <option value="brouillon">Brouillons</option>
            {activeTab === 'devis' ? (
              <>
                <option value="envoye">Envoyés</option>
                <option value="accepte">Acceptés</option>
              </>
            ) : (
              <>
                <option value="en_attente">En attente</option>
                <option value="payee">Payées</option>
              </>
            )}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-slate-600 dark:text-slate-400 mt-4">Chargement...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Numéro
                  </th>
                  {activeTab === 'factures' && (
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Type
                    </th>
                  )}
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Client
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Date
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Montant TTC
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Statut
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeTab === 'devis' ? (
                  filteredDevis.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-500 dark:text-slate-400">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        Aucun devis trouvé
                      </td>
                    </tr>
                  ) : (
                    filteredDevis.map((devis) => (
                      <tr
                        key={devis.id}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                            {devis.number}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-900 dark:text-white">{devis.clientName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {formatDate(devis.date)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(devis.totalTTC)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {getDevisStatusBadge(devis.status)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="p-2 text-slate-600 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              title="Voir"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {devis.status === DevisStatus.DRAFT && (
                              <button
                                className="p-2 text-slate-600 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                title="Modifier"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              className="p-2 text-slate-600 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              title="Télécharger PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )
                ) : (
                  filteredFactures.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500 dark:text-slate-400">
                        <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        Aucune facture trouvée
                      </td>
                    </tr>
                  ) : (
                    filteredFactures.map((facture) => (
                      <tr
                        key={facture.id}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                            {facture.number}
                          </span>
                          {facture.sentDate && (
                            <div className="flex items-center gap-1 mt-1">
                              <FileCheck className="w-3 h-3 text-emerald-500" />
                              <span className="text-xs text-emerald-600 dark:text-emerald-400">Envoyée</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            {getFactureTypeLabel(facture.type)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-900 dark:text-white">{facture.clientName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {formatDate(facture.date)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {formatCurrency(facture.totalTTC)}
                            </span>
                            {facture.remainingAmount > 0 && facture.status !== FactureStatus.DRAFT && (
                              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                Reste: {formatCurrency(facture.remainingAmount)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {getFactureStatusBadge(facture.status)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="p-2 text-slate-600 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              title="Voir"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {facture.status === FactureStatus.DRAFT && (
                              <button
                                className="p-2 text-slate-600 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                title="Modifier"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              className="p-2 text-slate-600 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              title="Télécharger PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && (activeTab === 'devis' ? filteredDevis.length === 0 : filteredFactures.length === 0) && (
        <div className="glass-card p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              {activeTab === 'devis' ? (
                <FileText className="w-8 h-8 text-primary" />
              ) : (
                <Receipt className="w-8 h-8 text-primary" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Aucun {activeTab === 'devis' ? 'devis' : 'facture'} pour le moment
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Commencez par créer votre premier {activeTab === 'devis' ? 'devis' : 'facture'} pour vos clients.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Créer un {activeTab === 'devis' ? 'devis' : 'facture'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevisFacturesPage;
