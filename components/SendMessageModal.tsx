import React, { useState } from 'react';
import { X, Send, Paperclip, Users, User, Briefcase, Sparkles } from 'lucide-react';
import { Client, User as UserType, ProjectMessage } from '../types';
import { saveDocument, uploadFileToCloud } from '../services/firebaseService';
import { draftMessageWithAI } from '../services/openrouterService';

interface SendMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType;
  clients: Client[];
  projects: any[];
}

const SendMessageModal: React.FC<SendMessageModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  clients,
  projects
}) => {
  const [recipientType, setRecipientType] = useState<'CLIENT' | 'PARTNER' | 'ALL'>('CLIENT');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(false);

  if (!isOpen) return null;

  const handleAIDraft = async () => {
    try {
      setAiDrafting(true);
      const draftedMessage = await draftMessageWithAI(subject, message, recipientType);
      setMessage(draftedMessage);
    } catch (error) {
      console.error('AI draft error:', error);
      alert('Erreur lors de la génération du message');
    } finally {
      setAiDrafting(false);
    }
  };

  const getRecipients = () => {
    if (recipientType === 'CLIENT') {
      return clients.filter(c => (c.type === 'PARTICULIER' || c.type === 'ENTREPRISE' || c.type === 'ARCHITECTE' || c.type === 'SYNDIC' || c.type === 'BAILLEUR' || c.type === 'SCI') && c.userId);
    } else if (recipientType === 'PARTNER') {
      return clients.filter(c => (c.type === 'PARTENAIRE' || c.type === 'SOUS_TRAITANT') && c.userId);
    }
    return clients.filter(c => c.userId);
  };

  const handleSend = async () => {
    if (!message.trim() || selectedRecipients.length === 0) return;

    setSending(true);
    try {
      const uploadedAttachments = [];
      
      for (const file of attachments) {
        const url = await uploadFileToCloud(`messages/${Date.now()}_${file.name}`, file);
        uploadedAttachments.push({
          name: file.name,
          url,
          type: file.type
        });
      }

      for (const recipientId of selectedRecipients) {
        const recipient = clients.find(c => c.userId === recipientId);
        if (!recipient) continue;

        const messageData: ProjectMessage = {
          id: `msg_${Date.now()}_${recipientId}`,
          projectId: selectedProject || 'general',
          senderId: currentUser.id,
          senderName: currentUser.fullName,
          senderRole: 'ADMIN',
          message: `**${subject}**\n\n${message}`,
          timestamp: Date.now(),
          read: false,
          attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined
        };

        await saveDocument('messages', messageData.id, messageData);

        const notification = {
          id: `notif_${Date.now()}_${recipientId}`,
          userId: recipientId,
          type: 'MESSAGE',
          title: subject || 'Nouveau message',
          message: message.substring(0, 100),
          read: false,
          createdAt: Date.now(),
          link: selectedProject ? `/project/${selectedProject}` : '/messages'
        };
        await saveDocument('notifications', notification.id, notification);
      }

      setMessage('');
      setSubject('');
      setSelectedRecipients([]);
      setAttachments([]);
      onClose();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Erreur lors de l\'envoi du message');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  const recipients = getRecipients();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Envoyer un message
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type de destinataire
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setRecipientType('CLIENT');
                  setSelectedRecipients([]);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  recipientType === 'CLIENT'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <User size={16} />
                Clients
              </button>
              <button
                onClick={() => {
                  setRecipientType('PARTNER');
                  setSelectedRecipients([]);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  recipientType === 'PARTNER'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Briefcase size={16} />
                Partenaires
              </button>
              <button
                onClick={() => {
                  setRecipientType('ALL');
                  setSelectedRecipients([]);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  recipientType === 'ALL'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Users size={16} />
                Tous
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Destinataires ({recipients.length} disponibles)
            </label>
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 max-h-40 overflow-y-auto">
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRecipients.length === recipients.length && recipients.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRecipients(recipients.map(r => r.userId!));
                      } else {
                        setSelectedRecipients([]);
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Sélectionner tout
                  </span>
                </label>
                {recipients.map((recipient) => (
                  <label key={recipient.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRecipients.includes(recipient.userId!)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRecipients([...selectedRecipients, recipient.userId!]);
                        } else {
                          setSelectedRecipients(selectedRecipients.filter(id => id !== recipient.userId));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-900 dark:text-white">
                      {recipient.name} {recipient.companyName && `(${recipient.companyName})`}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Projet associé (optionnel)
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Aucun projet spécifique</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sujet
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Sujet du message..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Message
              </label>
              <button
                type="button"
                onClick={handleAIDraft}
                disabled={aiDrafting}
                className="flex items-center gap-1.5 px-3 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles size={13} />
                {aiDrafting ? 'Génération...' : 'Rédiger avec IA'}
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Votre message..."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pièces jointes
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((file, idx) => (
                  <div key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <Paperclip size={14} />
                    {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !message.trim() || selectedRecipients.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
            {sending ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendMessageModal;
