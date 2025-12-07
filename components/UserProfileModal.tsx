
import React, { useState } from 'react';
import { User, X, Check } from 'lucide-react';
import { User as UserType } from '../types';

interface UserProfileModalProps {
  user: UserType;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedUser: UserType) => void;
}

const colors = [
    { name: 'Emeraude', class: 'bg-emerald-600' },
    { name: 'Bleu', class: 'bg-blue-600' },
    { name: 'Indigo', class: 'bg-indigo-600' },
    { name: 'Violet', class: 'bg-purple-600' },
    { name: 'Rose', class: 'bg-pink-600' },
    { name: 'Rouge', class: 'bg-red-600' },
    { name: 'Orange', class: 'bg-orange-500' },
    { name: 'Gris', class: 'bg-slate-600' },
    { name: 'Noir', class: 'bg-slate-900' },
];

const UserProfileModal: React.FC<UserProfileModalProps> = ({ user, isOpen, onClose, onSave }) => {
  const [initials, setInitials] = useState(user.customInitials || user.fullName.substring(0, 2).toUpperCase());
  const [selectedColor, setSelectedColor] = useState(user.avatarColor || 'bg-emerald-600');

  if (!isOpen) return null;

  const handleSave = () => {
      onSave({
          ...user,
          customInitials: initials,
          avatarColor: selectedColor
      });
      onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">Personnaliser mon profil</h3>
            <button onClick={onClose} className="text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 dark:hover:text-slate-200">
                <X size={20} />
            </button>
        </div>

        <div className="p-6 space-y-6">
            <div className="flex flex-col items-center">
                <div className={`h-20 w-20 rounded-full ${selectedColor} text-slate-900 dark:text-white dark:text-white flex items-center justify-center text-2xl font-bold shadow-lg mb-4 transition-colors duration-300`}>
                    {initials}
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-white dark:text-white dark:text-white">{user.fullName}</p>
                <p className="text-xs text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white">{user.role === 'ADMIN' ? 'Administrateur' : 'Utilisateur'}</p>
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white uppercase mb-2">Initiales (2 max)</label>
                <input 
                    type="text" 
                    maxLength={2}
                    value={initials}
                    onChange={(e) => setInitials(e.target.value.toUpperCase())}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-center font-bold tracking-widest text-slate-900 dark:text-white dark:text-white dark:text-white"
                />
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white uppercase mb-2">Couleur de fond</label>
                <div className="grid grid-cols-5 gap-3">
                    {colors.map((c) => (
                        <button
                            key={c.name}
                            onClick={() => setSelectedColor(c.class)}
                            className={`h-8 w-8 rounded-full ${c.class} hover:scale-110 transition-transform relative`}
                            title={c.name}
                        >
                            {selectedColor === c.class && (
                                <span className="absolute inset-0 flex items-center justify-center text-slate-900 dark:text-white dark:text-white">
                                    <Check size={14} strokeWidth={3} />
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <button 
                onClick={handleSave}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200 dark:shadow-none transition-all"
            >
                Enregistrer les modifications
            </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
