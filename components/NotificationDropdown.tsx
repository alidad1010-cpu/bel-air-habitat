
import React from 'react';
import { Bell, AlertCircle, Clock, CheckCircle, Info, X } from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationDropdownProps {
  notifications: AppNotification[];
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (projectId: string) => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ notifications, isOpen, onClose, onNavigate }) => {
  if (!isOpen) return null;

  const getIcon = (type: string) => {
      switch(type) {
          case 'ALERT': return <AlertCircle size={16} className="text-red-500" />;
          case 'WARNING': return <Clock size={16} className="text-orange-500" />;
          case 'SUCCESS': return <CheckCircle size={16} className="text-emerald-500" />;
          default: return <Info size={16} className="text-blue-500" />;
      }
  };

  return (
    <div className="absolute right-0 top-12 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
      <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white text-sm">Notifications</h3>
          <button onClick={onClose} className="text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200">
              <X size={16} />
          </button>
      </div>
      
      <div className="max-h-[300px] overflow-y-auto">
          {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-700 dark:text-slate-200 dark:text-white flex flex-col items-center">
                  <Bell size={24} className="mb-2 opacity-20" />
                  <span className="text-xs">Aucune notification</span>
              </div>
          ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        onClick={() => {
                            if (notif.projectId) onNavigate(notif.projectId);
                            onClose();
                        }}
                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors flex items-start space-x-3"
                      >
                          <div className="mt-0.5 shrink-0">
                              {getIcon(notif.type)}
                          </div>
                          <div>
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">{notif.title}</p>
                              <p className="text-xs text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white mt-0.5 line-clamp-2">{notif.message}</p>
                              <span className="text-[10px] text-slate-700 dark:text-slate-200 dark:text-white mt-1 block">
                                  {new Date(notif.date).toLocaleDateString()}
                              </span>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
