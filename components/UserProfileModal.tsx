
import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
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
    const [fullName, setFullName] = useState(user.fullName || '');
    // Helper to generate initials from name
    const getInitials = (name: string) => {
        if (!name) return '??';
        const parts = name.split(' ').filter(p => p.length > 0);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    const [initials, setInitials] = useState(user.customInitials || getInitials(user.fullName));
    const [selectedColor, setSelectedColor] = useState(user.avatarColor || 'bg-emerald-600');
    const [username, setUsername] = useState(user.username || '');
    const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave({
            ...user,
            fullName: fullName,
            username: username,
            customInitials: initials,
            avatarColor: selectedColor,
            avatarUrl: avatarUrl
        });
        onClose();
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value;
        setFullName(newName);
        // Auto-update initials only if standard format
        setInitials(getInitials(newName));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const path = `users/${user.id}/avatar_${Date.now()}`;
            // Dynamic import to avoid top-level dependency issues if not already imported
            const url = await import('../services/firebaseService').then(m => m.uploadFileToCloud(path, file));
            setAvatarUrl(url);
        } catch (error) {
            console.error("Avatar upload failed", error);
            alert("Erreur lors de l'upload de la photo");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white">Personnaliser mon profil</h3>
                    <button onClick={onClose} className="text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 dark:hover:text-slate-200">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex flex-col items-center">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Profil" className="h-20 w-20 rounded-full object-cover shadow-lg mb-4" />
                            ) : (
                                <div className={`h-20 w-20 rounded-full ${selectedColor} text-slate-900 dark:text-white flex items-center justify-center text-2xl font-bold shadow-lg mb-4 transition-colors duration-300`}>
                                    {initials}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity mb-4">
                                <span className="text-white text-xs font-bold">Modifier</span>
                            </div>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

                        {isUploading && <p className="text-xs text-emerald-600 font-bold animate-pulse mb-2">Envoi en cours...</p>}

                        {/* Editable Full Name */}
                        <input
                            type="text"
                            value={fullName}
                            onChange={handleNameChange}
                            className="text-sm font-medium text-slate-900 dark:text-white text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 outline-none transition-colors"
                            placeholder="Votre nom complet"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">{user.role === 'ADMIN' ? 'Administrateur' : 'Utilisateur'}</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase mb-2">Nom d'utilisateur / Surnom</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
                                placeholder="Pseudo (optionnel)"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase mb-2">Initiales</label>
                            <input
                                type="text"
                                maxLength={4}
                                value={initials}
                                onChange={(e) => setInitials(e.target.value.toUpperCase())}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-center font-bold tracking-widest text-slate-900 dark:text-white"
                                placeholder="ex. AB"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase mb-2">Couleur de fond</label>
                            <div className="grid grid-cols-5 gap-3">
                                {colors.map((c) => (
                                    <button
                                        key={c.name}
                                        onClick={() => setSelectedColor(c.class)}
                                        className={`h-8 w-8 rounded-full ${c.class} hover:scale-110 transition-transform relative`}
                                        title={c.name}
                                    >
                                        {selectedColor === c.class && (
                                            <span className="absolute inset-0 flex items-center justify-center text-slate-900 dark:text-white">
                                                <Check size={14} strokeWidth={3} />
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
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
