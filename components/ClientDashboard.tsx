import React, { useState, useEffect } from 'react';
import { User, Project, ProjectStatus, ProjectMessage } from '../types';
import { 
  FileText, 
  Download, 
  CheckCircle, 
  Clock, 
  MessageSquare, 
  Image as ImageIcon,
  AlertCircle,
  Send,
  Paperclip,
  Eye
} from 'lucide-react';
import { subscribeToCollection, saveDocument, where } from '../services/firebaseService';

interface ClientDashboardProps {
  currentUser: User;
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ currentUser }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.id) return;

    const unsubscribe = subscribeToCollection(
      'projects',
      (data) => {
        const clientProjects = (data as Project[]).filter(p => p.client?.userId === currentUser.id);
        setProjects(clientProjects);
        setLoading(false);
      },
      [where('client.userId', '==', currentUser.id)]
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
      senderRole: 'CLIENT',
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

  const handleValidateQuote = async (project: Project) => {
    try {
      const updatedProject = {
        ...project,
        status: ProjectStatus.VALIDATED,
        quoteValidatedAt: Date.now()
      };
      await saveDocument('projects', project.id, updatedProject);

      const notificationMessage: ProjectMessage = {
        id: `msg_${Date.now()}`,
        projectId: project.id,
        senderId: currentUser.id,
        senderName: currentUser.fullName,
        senderRole: 'CLIENT',
        message: '✅ Le devis a été validé par le client',
        timestamp: Date.now(),
        read: false
      };
      await saveDocument('messages', notificationMessage.id, notificationMessage);
    } catch (error) {
      console.error('Error validating quote:', error);
    }
  };

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.COMPLETED:
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case ProjectStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case ProjectStatus.QUOTE_SENT:
      case ProjectStatus.WAITING_VALIDATION:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
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
      case ProjectStatus.QUOTE_SENT:
      case ProjectStatus.WAITING_VALIDATION:
        return <AlertCircle size={20} />;
      default:
        return <FileText size={20} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Bienvenue, {currentUser.fullName}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Suivez l'avancement de vos projets en temps réel
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <FileText size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Aucun projet pour le moment
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Vos projets apparaîtront ici une fois créés par notre équipe.
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

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {project.budget && (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Budget</div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-white">
                            {project.budget.toLocaleString('fr-FR')} €
                          </div>
                        </div>
                      )}
                      {project.createdAt && (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Créé le</div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(project.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {project.quoteUrl && (
                        <a
                          href={project.quoteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Eye size={16} />
                          Voir le devis
                        </a>
                      )}
                      {project.status === ProjectStatus.QUOTE_SENT && (
                        <button
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleValidateQuote(project);
                          }}
                        >
                          <CheckCircle size={16} />
                          Valider le devis
                        </button>
                      )}
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
                    </div>

                    {project.photos && project.photos.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <ImageIcon size={16} />
                          <span>{project.photos.length} photo(s)</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {project.photos.slice(0, 4).map((photo, idx) => (
                            <img
                              key={idx}
                              src={photo.url}
                              alt={photo.label || 'Photo'}
                              className="w-full h-20 object-cover rounded-lg"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {(project.documents && project.documents.length > 0) || (project.invoices && project.invoices.length > 0) ? (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <FileText size={16} />
                          <span>Documents</span>
                        </div>
                        <div className="space-y-2">
                          {project.documents?.map((doc) => (
                            <a
                              key={doc.id}
                              href={doc.url}
                              download
                              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-2">
                                <FileText size={14} />
                                <span className="text-sm">{doc.name}</span>
                              </div>
                              <Download size={14} />
                            </a>
                          ))}
                          {project.invoices?.map((invoice) => (
                            <div
                              key={invoice.id}
                              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                <FileText size={14} />
                                <span className="text-sm">Facture {invoice.number}</span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  invoice.status === 'Payée' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                  invoice.status === 'En attente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                  {invoice.status}
                                </span>
                              </div>
                              <span className="text-sm font-semibold">{invoice.amountHT.toLocaleString('fr-FR')} € HT</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
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
                            msg.senderRole === 'CLIENT'
                              ? 'bg-purple-100 dark:bg-purple-900/30 ml-8'
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
                          <p className="text-sm text-gray-700 dark:text-gray-300">{msg.message}</p>
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
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim()}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

export default ClientDashboard;
