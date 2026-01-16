
import React, { useState, useEffect } from 'react';
import { User, Plus, Trash2, Moon, Sun, Download, Database, Link, Zap, Check, ShieldAlert, Eye, EyeOff, RefreshCw, AlertCircle, Trash } from 'lucide-react';
import { User as UserType, UserRole } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsPageProps {
    currentUser: UserType;
    users: UserType[];
    onAddUser: (user: UserType) => void;
    onDeleteUser: (id: string) => void;
    onUpdateUser: (user: UserType) => void;

}

const SettingsPage: React.FC<SettingsPageProps> = ({
    currentUser,
    users,
    onAddUser,
    onDeleteUser,
    onUpdateUser,

}) => {
    const { theme, toggleTheme } = useTheme();
    const [activeTab, setActiveTab] = useState('data');
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);

    // Integrations State
    const [integrations, setIntegrations] = useState(currentUser.integrations || { googleCalendarUrl: '', smsApiKey: '', automationWebhook: '' });

    const [newUser, setNewUser] = useState({
        username: '',
        fullName: '',
        role: 'USER' as UserRole,
        password: '',
        email: ''
    });

    // State to track which user's password is visible
    const [visiblePasswordId, setVisiblePasswordId] = useState<string | null>(null);

    // Input styles ensuring high contrast
    const inputClass = "w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder-slate-400";
    const labelClass = "block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase mb-1";

    const handleCreateUser = (e: React.FormEvent) => {
        e.preventDefault();
        const user: UserType = {
            id: Date.now().toString(),
            username: newUser.username,
            fullName: newUser.fullName,
            role: newUser.role,
            password: newUser.password,
            email: newUser.email,
            lastLogin: 0
        };
        onAddUser(user);
        setIsAddUserOpen(false);
        setNewUser({ username: '', fullName: '', role: 'USER', password: '', email: '' });
    };

    const handleSaveIntegrations = () => {
        let cleanWebhook = integrations.automationWebhook?.trim() || '';

        if (cleanWebhook) {
            if (!cleanWebhook.startsWith('http')) {
                cleanWebhook = `https://hook.eu1.make.com/${cleanWebhook}`;
            }
            if (cleanWebhook.includes('@')) {
                cleanWebhook = cleanWebhook.replace('@', '/');
                if (!cleanWebhook.startsWith('http')) {
                    cleanWebhook = `https://${cleanWebhook}`;
                }
            }
        }

        const finalIntegrations = { ...integrations, automationWebhook: cleanWebhook };
        setIntegrations(finalIntegrations);

        const updatedUser = { ...currentUser, integrations: finalIntegrations };
        onUpdateUser(updatedUser);

        alert(`Configuration enregistrée !\nWebhook actif : ${cleanWebhook}`);
    };

    // Safe Sanitizer specifically for Export
    const safeExportStringify = (data: any) => {
        const seen = new WeakSet();
        const prune = (obj: any): any => {
            if (obj === null || typeof obj !== 'object') return obj;
            if (seen.has(obj)) return undefined;
            seen.add(obj);
            if (obj instanceof Date) return obj.toISOString();
            if (Array.isArray(obj)) return obj.map(o => prune(o));
            if (obj instanceof Element || obj instanceof Event || (typeof window !== 'undefined' && (obj === window || obj === document)) || (obj.nodeType && obj.nodeName) || obj.$$typeof) return undefined;
            const newObj: any = {};
            for (const k in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, k)) {
                    if (k.startsWith('_') || k === 'firestore' || k === 'source' || k === 'src' || k === 'view' || k === 'ownerDocument' || typeof obj[k] === 'function') continue;
                    const val = prune(obj[k]);
                    if (val !== undefined) newObj[k] = val;
                }
            }
            return newObj;
        };
        try { return JSON.stringify(prune(data), null, 2); } catch (e) { return "{}"; }
    };

    const handleExportData = () => {
        try {
            const projectsStr = localStorage.getItem('artisan-projects-backup');
            const clientsStr = localStorage.getItem('artisan-clients-backup');
            const projects = projectsStr ? JSON.parse(projectsStr) : [];
            const clients = clientsStr ? JSON.parse(clientsStr) : [];
            const backup = {
                date: new Date().toISOString(),
                projects: projects,
                clients: clients,
                users: users
            };
            const jsonString = safeExportStringify(backup);
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `backup_belair_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        } catch (e) {
            alert("Erreur lors de l'export.");
        }
    };

    const isAdmin = currentUser.role === 'ADMIN';

    // Diagnostic & Cache Management State
    const [serviceWorkerStatus, setServiceWorkerStatus] = useState<'unknown' | 'registered' | 'unregistered'>('unknown');
    const [cacheStatus, setCacheStatus] = useState<{ size: string; count: number } | null>(null);
    const [buildInfo, setBuildInfo] = useState<{ version: string; timestamp: string } | null>(null);

    useEffect(() => {
        // Check Service Worker status
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                setServiceWorkerStatus(registrations.length > 0 ? 'registered' : 'unregistered');
            });
        }

        // Get build info from meta or env
        const version = import.meta.env.VITE_APP_VERSION || 'dev';
        const timestamp = new Date().toLocaleString('fr-FR');
        setBuildInfo({ version, timestamp });
    }, []);

    const handleUnregisterServiceWorker = async () => {
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                setServiceWorkerStatus('unregistered');
                alert('Service Worker désactivé avec succès. La page va se recharger.');
                window.location.reload();
            } catch (error) {
                alert('Erreur lors de la désactivation du Service Worker.');
                console.error('SW unregister error:', error);
            }
        }
    };

    const handleClearLocalStorage = () => {
        if (window.confirm('Vider localStorage ? Toutes les données locales seront supprimées.')) {
            localStorage.clear();
            alert('localStorage vidé. La page va se recharger.');
            window.location.reload();
        }
    };

    const handleClearSessionStorage = () => {
        if (window.confirm('Vider sessionStorage ? Vous devrez vous reconnecter.')) {
            sessionStorage.clear();
            alert('sessionStorage vidé. La page va se recharger.');
            window.location.reload();
        }
    };

    const handleClearAllCaches = async () => {
        if (window.confirm('Vider tous les caches (Service Worker + localStorage + sessionStorage) ? Vous devrez vous reconnecter.')) {
            // Clear Service Worker caches
            if ('caches' in window) {
                try {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                } catch (error) {
                    console.error('Cache clear error:', error);
                }
            }

            // Unregister Service Worker
            if ('serviceWorker' in navigator) {
                try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations) {
                        await registration.unregister();
                    }
                } catch (error) {
                    console.error('SW unregister error:', error);
                }
            }

            // Clear storage
            localStorage.clear();
            sessionStorage.clear();

            setServiceWorkerStatus('unregistered');
            alert('Tous les caches ont été vidés. La page va se recharger.');
            window.location.reload();
        }
    };

    const handleHardReload = () => {
        // Force reload bypassing cache
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                registrations.forEach(registration => {
                    registration.update();
                });
            });
        }
        window.location.reload(true);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in p-2 md:p-0">

            {/* Theme Status Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-indigo-900 text-indigo-300' : 'bg-amber-100 text-amber-700'}`}>
                            {theme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100 dark:text-white">Apparence</h3>
                            <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-white">
                                Mode {theme === 'dark' ? 'Sombre' : 'Clair'} activé
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={toggleTheme}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            theme === 'dark' ? 'bg-indigo-600' : 'bg-amber-400'
                        }`}
                        aria-label="Basculer le thème"
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>
            </div>

            {/* Main Settings Panel */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-4 py-4 md:px-6 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">Paramètres</h2>
                </div>

                <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('data')}
                        className={`px-4 md:px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center whitespace-nowrap ${activeTab === 'data' ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-transparent text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                        <Database size={18} className="mr-2" />
                        Données
                    </button>
                    <button
                        onClick={() => setActiveTab('diagnostic')}
                        className={`px-4 md:px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center whitespace-nowrap ${activeTab === 'diagnostic' ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-transparent text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                        <RefreshCw size={18} className="mr-2" />
                        Diagnostic
                    </button>
                    {isAdmin && (
                        <>
                            <button
                                onClick={() => setActiveTab('users')}
                                className={`px-4 md:px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center whitespace-nowrap ${activeTab === 'users' ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-transparent text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                            >
                                <User size={18} className="mr-2" />
                                Accès & Équipe
                            </button>
                            <button
                                onClick={() => setActiveTab('integrations')}
                                className={`px-4 md:px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center whitespace-nowrap ${activeTab === 'integrations' ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-transparent text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                            >
                                <Link size={18} className="mr-2" />
                                Intégrations
                            </button>
                        </>
                    )}
                </div>

                <div className="p-4 md:p-6 min-h-[500px]">

                    {activeTab === 'data' && (
                        <div className="space-y-6">
                            <div className="flex items-center space-x-4 mb-4">
                                <div className="p-3 rounded-full bg-slate-100 text-slate-700 dark:text-slate-200 dark:bg-slate-800 dark:text-white">
                                    <Database size={24} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">Gestion des Données</h3>
                                    <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white">
                                        Sauvegardez vos données localement pour éviter toute perte.
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                <button
                                    onClick={handleExportData}
                                    className="flex items-center bg-slate-800 hover:bg-slate-900 text-slate-900 dark:text-white dark:text-white px-4 py-2 rounded-lg font-medium transition-colors"
                                >
                                    <Download size={18} className="mr-2" /> Exporter les données (JSON)
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'diagnostic' && (
                        <div className="space-y-6">
                            <div className="flex items-center space-x-4 mb-4">
                                <div className="p-3 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                    <RefreshCw size={24} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 dark:text-white">Diagnostic & Cache</h3>
                                    <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-white">
                                        Gérez les caches et diagnostiquez les problèmes de chargement.
                                    </p>
                                </div>
                            </div>

                            {/* Build Info */}
                            {buildInfo && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                    <h4 className="font-semibold text-slate-800 dark:text-slate-100 dark:text-white mb-2">Informations de Version</h4>
                                    <div className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                                        <p><span className="font-medium">Version:</span> {buildInfo.version}</p>
                                        <p><span className="font-medium">Dernière mise à jour:</span> {buildInfo.timestamp}</p>
                                    </div>
                                </div>
                            )}

                            {/* Service Worker Status */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                <h4 className="font-semibold text-slate-800 dark:text-slate-100 dark:text-white mb-3 flex items-center">
                                    <AlertCircle size={18} className="mr-2" />
                                    Service Worker (PWA)
                                </h4>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-700 dark:text-slate-300">
                                            Statut: <span className="font-medium">{serviceWorkerStatus === 'registered' ? '✅ Actif' : serviceWorkerStatus === 'unregistered' ? '❌ Désactivé' : '⏳ Vérification...'}</span>
                                        </span>
                                    </div>
                                    {serviceWorkerStatus === 'registered' && (
                                        <button
                                            onClick={handleUnregisterServiceWorker}
                                            className="flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
                                        >
                                            <Trash size={16} className="mr-2" />
                                            Désactiver le Service Worker
                                        </button>
                                    )}
                                    <p className="text-xs text-slate-600 dark:text-slate-400">
                                        Le Service Worker peut garder l'ancienne version en cache. Désactivez-le si les changements ne s'affichent pas.
                                    </p>
                                </div>
                            </div>

                            {/* Cache Management */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                <h4 className="font-semibold text-slate-800 dark:text-slate-100 dark:text-white mb-3">Gestion des Caches</h4>
                                <div className="space-y-3">
                                    <button
                                        onClick={handleClearLocalStorage}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 transition-colors"
                                    >
                                        <div className="flex items-center">
                                            <Trash size={16} className="mr-2" />
                                            <span className="font-medium">Vider localStorage</span>
                                        </div>
                                        <span className="text-xs">Supprime les données locales</span>
                                    </button>

                                    <button
                                        onClick={handleClearSessionStorage}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-lg border border-orange-200 dark:border-orange-800 transition-colors"
                                    >
                                        <div className="flex items-center">
                                            <Trash size={16} className="mr-2" />
                                            <span className="font-medium">Vider sessionStorage</span>
                                        </div>
                                        <span className="text-xs">Déconnecte la session</span>
                                    </button>

                                    <button
                                        onClick={handleClearAllCaches}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                                    >
                                        <div className="flex items-center">
                                            <RefreshCw size={16} className="mr-2" />
                                            <span>Vider TOUS les caches</span>
                                        </div>
                                        <span className="text-xs">Complet (reconnexion requise)</span>
                                    </button>

                                    <button
                                        onClick={handleHardReload}
                                        className="w-full flex items-center justify-center px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                                    >
                                        <RefreshCw size={16} className="mr-2" />
                                        Recharger en ignorant le cache
                                    </button>
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center">
                                    <AlertCircle size={18} className="mr-2" />
                                    Instructions pour Safari Mac
                                </h4>
                                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
                                    <li>Ouvrez les DevTools (Cmd + Option + I)</li>
                                    <li>Allez dans l'onglet <strong>"Application"</strong> ou <strong>"Storage"</strong></li>
                                    <li>Dans le menu de gauche, cliquez sur <strong>"Service Workers"</strong></li>
                                    <li>Cliquez sur <strong>"Unregister"</strong> pour désactiver le Service Worker</li>
                                    <li>Allez dans <strong>"Clear storage"</strong> et cochez tout</li>
                                    <li>Cliquez sur <strong>"Clear site data"</strong></li>
                                    <li>Actualisez la page (Cmd + R)</li>
                                </ol>
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && isAdmin && (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">Utilisateurs</h3>
                                    <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white">Gérez les comptes d'accès.</p>
                                </div>
                                <button
                                    onClick={() => setIsAddUserOpen(true)}
                                    className="w-full md:w-auto flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-medium text-sm"
                                >
                                    <Plus size={16} className="mr-2" />
                                    Créer un accès
                                </button>
                            </div>

                            {isAddUserOpen && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 rounded-xl p-6 mb-6">
                                    <h4 className="font-semibold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white mb-4">Nouvel Utilisateur</h4>
                                    <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div><label className={labelClass}>Identifiant</label><input required type="text" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} className={inputClass} placeholder="Identifiant" /></div>
                                        <div><label className={labelClass}>Nom Complet</label><input required type="text" value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} className={inputClass} placeholder="Nom complet" /></div>
                                        <div><label className={labelClass}>Email</label><input required type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className={inputClass} placeholder="Email" /></div>
                                        <div><label className={labelClass}>Mot de passe</label><input required type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className={inputClass} placeholder="Mot de passe" /></div>
                                        <div><label className={labelClass}>Rôle</label><select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })} className={inputClass}>
                                            <option value="USER">Utilisateur</option>
                                            <option value="ADMIN">Administrateur</option>
                                        </select></div>
                                        <div className="md:col-span-2 flex justify-end space-x-3 mt-2">
                                            <button type="button" onClick={() => setIsAddUserOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-200 dark:text-white bg-slate-200 dark:bg-slate-600 rounded text-sm">Annuler</button>
                                            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium">Enregistrer</button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 dark:text-white font-medium border-b dark:border-slate-600">
                                        <tr>
                                            <th className="px-4 py-3 whitespace-nowrap">Utilisateur</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Rôle</th>
                                            <th className="px-4 py-3 hidden md:table-cell">Email</th>
                                            <th className="px-4 py-3">Mot de passe</th>
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {users.map(user => (
                                            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center">
                                                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mr-3 shrink-0">
                                                            {user.fullName.charAt(0)}
                                                        </div>
                                                        <div className="truncate max-w-[120px] md:max-w-none">
                                                            <div className="font-medium text-slate-900 dark:text-white dark:text-white dark:text-white truncate">{user.fullName}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-700 dark:text-slate-200 dark:text-white hidden md:table-cell">{user.email}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center">
                                                        <span className="font-mono text-xs text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white mr-2">
                                                            {visiblePasswordId === user.id ? user.password : '••••••'}
                                                        </span>
                                                        <button
                                                            onClick={() => setVisiblePasswordId(visiblePasswordId === user.id ? null : user.id)}
                                                            className="text-slate-700 dark:text-slate-200 dark:text-white hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
                                                            title={visiblePasswordId === user.id ? "Masquer" : "Voir le mot de passe"}
                                                        >
                                                            {visiblePasswordId === user.id ? <EyeOff size={14} /> : <Eye size={14} />}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {user.id !== currentUser.id && (
                                                        <button onClick={() => onDeleteUser(user.id)} className="p-1.5 text-slate-700 dark:text-slate-200 dark:text-white hover:text-red-500">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'integrations' && isAdmin && (
                        <div className="max-w-3xl space-y-8 animate-in fade-in">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">Intégrations Externes</h3>
                                <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white">Connectez vos services tiers pour automatiser votre activité.</p>
                            </div>

                            <div className="bg-purple-50 dark:bg-purple-900/10 p-6 rounded-xl border-2 border-purple-200 dark:border-purple-800 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Zap size={100} className="text-purple-600" />
                                </div>
                                <div className="flex items-start space-x-4 mb-4 relative z-10">
                                    <div className="bg-purple-500 p-3 rounded-xl text-slate-900 dark:text-white dark:text-white shadow-lg shadow-purple-500/30">
                                        <Zap size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white text-lg">Automatisation (Make.com)</h4>
                                        <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-white mt-1">
                                            Copiez votre lien Webhook ici pour activer l'envoi automatique vers Google Agenda et SMS.
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-6 relative z-10">
                                    <label className="block text-xs font-bold text-purple-800 dark:text-purple-300 uppercase mb-2">URL du Webhook</label>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="text"
                                            value={integrations.automationWebhook || ''}
                                            onChange={(e) => setIntegrations({ ...integrations, automationWebhook: e.target.value })}
                                            className={inputClass}
                                            placeholder="Ex: https://hook.eu1.make.com/..."
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-700 dark:text-slate-200 dark:text-white mt-2">
                                        Astuce : Vous pouvez coller le lien entier ou juste le code de fin.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 dark:bg-slate-800/30 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div className="flex items-start space-x-4 mb-4">
                                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                                        <Link size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">Google Agenda (Visuel)</h4>
                                        <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-white dark:text-white mt-1">
                                            Pour voir votre planning directement dans l'application.
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white uppercase mb-2">URL d'intégration (src iframe)</label>
                                    <input
                                        type="text"
                                        value={integrations.googleCalendarUrl}
                                        onChange={(e) => setIntegrations({ ...integrations, googleCalendarUrl: e.target.value })}
                                        className={inputClass}
                                        placeholder="https://calendar.google.com/calendar/embed?src=..."
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                                <button
                                    onClick={handleSaveIntegrations}
                                    className="flex items-center bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none transition-all hover:scale-105"
                                >
                                    <Check size={20} className="mr-2" />
                                    Enregistrer les configurations
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && !isAdmin && (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-slate-700 dark:text-slate-200 dark:text-white">
                            <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-full mb-4">
                                <ShieldAlert size={48} className="text-slate-300 dark:text-white" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 dark:text-white">Accès Restreint</h3>
                            <p className="max-w-md mt-2">
                                La gestion des équipes est réservée aux administrateurs.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
