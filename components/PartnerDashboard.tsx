import React, { useState, useEffect } from 'react';
import { User, Project, ProjectStatus, ProjectMessage, PurchaseOrder } from '../types';
import {
  FileText,
  Download,
  CheckCircle,
  Clock,
  MessageSquare,
  Image as ImageIcon,
  AlertCircle,
  Send,
  Eye,
  Package,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { subscribeToCollection, saveDocument, where } from '../services/firebaseService';

interface PartnerDashboardProps {
  currentUser: User;
}

const PartnerDashboard: React.FC<PartnerDashboardProps> = ({ currentUser }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProjects: 0,
    inProgress: 0,
    completed: 0,
    totalRevenue: 0
  });

  useEffect(() => {
    if (!currentUser?.id) return;

    const unsubscribe = subscribeToCollection(
      'projects',
      (data) => {
        const partnerProjects = (data as Project[]).filter(p => 
          p.purchaseOrders?.some(po => po.subcontractorId === currentUser.id)
        );
        setProjects(partnerProjects);
        
        const inProgress = partnerProjects.filter(p => p.status === ProjectStatus.IN_PROGRESS).length;
        const completed = partnerProjects.filter(p => p.status === ProjectStatus.COMPLETED).length;
        const totalRevenue = partnerProjects.reduce((sum, p) => {
          const partnerPOs = p.purchaseOrders?.filter(po => po.subcontractorId === currentUser.id) || [];
          return sum + partnerPOs.reduce((poSum, po) => poSum + (po.amountHT || 0), 0);
        }, 0);

        setStats({
          totalProjects: partnerProjects.length,
          inProgress,
          completed,
          totalRevenue
        });

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!selectedProject?.id) return;

    const unsubscribe = subscribeToCollection(
      'messages',
      (data) => {
        const projectMessages = (data as ProjectMessage[]).filter(m => m.projectId === selectedProject.id);
        setMessages(projectMessages.sort((a, b) => a.timestamp - b.timestamp));
      },
      [where('projectId', '==', selectedProject.id)]
    );

    return () => unsubscribe();
  }, [selectedProject]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedProject) return;

    const message: ProjectMessage = {
      id: `msg_${Date.now()}`,
      projectId: selectedProject.id,
      senderId: currentUser.id,
      senderName: currentUser.fullName,
      senderRole: 'PARTNER',
      message: newMessage,
      timestamp: Date.now(),
      read: false
    };

    try {
      await saveDocument('messages', message.id, message);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleUpdatePOStatus = async (project: Project, poId: string, newStatus: string) => {
    try {
      const updatedPOs = project.purchaseOrders?.map(po => 
        po.id === poId ? { ...po, status: newStatus, updatedAt: Date.now() } : po
      );
      
      const updatedProject = {
        ...project,
        purchaseOrders: updatedPOs,
        updatedAt: Date.now()
      };
      
      await saveDocument('projects', project.id, updatedProject);
      
      const notificationMessage: ProjectMessage = {
        id: `msg_${Date.now()}`,
        projectId: project.id,
        senderId: currentUser.id,
        senderName: currentUser.fullName,
        senderRole: 'PARTNER',
        message: `📦 Bon de commande mis à jour : ${newStatus}`,
        timestamp: Date.now(),
        read: false
      };
      await saveDocument('messages', notificationMessage.id, notificationMessage);
    } catch (error) {
      console.error('Error updating PO status:', error);
    }
  };

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.COMPLETED:
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case ProjectStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case ProjectStatus.VALIDATED:
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.COMPLETED:
        return <CheckCircle size={20} />;
      case ProjectStatus.IN_PROGRESS:
        return <Clock size={20} />;
      default:
        return <FileText size={20} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-lg text-gray-600 dark:text-gray-400">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Espace Partenaire - {currentUser.fullName}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Gérez vos chantiers et commandes en temps réel
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Chantiers</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalProjects}</p>
              </div>
              <Package className="text-blue-600" size={32} />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">En Cours</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.inProgress}</p>
              </div>
              <Clock className="text-orange-600" size={32} />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Terminés</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completed}</p>
              </div>
              <CheckCircle className="text-green-600" size={32} />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">CA Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalRevenue.toLocaleString('fr-FR')} €
                </p>
              </div>
              <TrendingUp className="text-purple-600" size={32} />
            </div>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <Package size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Aucun chantier pour le moment
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Vos chantiers apparaîtront ici une fois que vous serez assigné par l'équipe.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedProject(project)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                          {project.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          {project.description}
                        </p>
                      </div>
                      <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(project.status)}`}>
                        {getStatusIcon(project.status)}
                        {project.status}
                      </span>
                    </div>

                    {project.siteAddress && (
                      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                        📍 {project.siteAddress}
                      </div>
                    )}

                    {project.startDate && (
                      <div className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar size={16} />
                        <span>Début: {new Date(project.startDate).toLocaleDateString('fr-FR')}</span>
                      </div>
                    )}

                    {project.purchaseOrders && project.purchaseOrders.filter(po => po.subcontractorId === currentUser.id).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          Mes Bons de Commande
                        </h4>
                        <div className="space-y-2">
                          {project.purchaseOrders
                            .filter(po => po.subcontractorId === currentUser.id)
                            .map((po) => (
                              <div
                                key={po.id}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                      {po.number}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      po.status === 'SIGNED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                      po.status === 'SENT' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                      'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                                    }`}>
                                      {po.status === 'DRAFT' ? 'Brouillon' : po.status === 'SENT' ? 'Envoyé' : po.status === 'SIGNED' ? 'Signé' : 'Payé'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    {po.description}
                                  </p>
                                </div>
                                <div className="text-right ml-4">
                                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {po.amountHT?.toLocaleString('fr-FR')} €
                                  </div>
                                  {po.status !== 'SIGNED' && po.status !== 'PAID' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdatePOStatus(project, po.id, 'SIGNED');
                                      }}
                                      className="text-xs text-green-600 hover:text-green-700 mt-1"
                                    >
                                      Marquer comme validé
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 mt-4">
                      <button
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProject(project);
                        }}
                      >
                        <MessageSquare size={16} />
                        Messages
                      </button>
                      {project.photos && project.photos.length > 0 && (
                        <button
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ImageIcon size={16} />
                          {project.photos.length} photo(s)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedProject && (
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow sticky top-4">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <MessageSquare size={20} />
                      Messages - {selectedProject.title}
                    </h3>
                  </div>

                  <div className="h-96 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                        Aucun message pour le moment
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-lg ${
                            msg.senderRole === 'PARTNER'
                              ? 'bg-blue-100 dark:bg-blue-900/30 ml-8'
                              : 'bg-gray-100 dark:bg-gray-700 mr-8'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">
                              {msg.senderName}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 dark:text-white">{msg.message}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Votre message..."
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerDashboard;
