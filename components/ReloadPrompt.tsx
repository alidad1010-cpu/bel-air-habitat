import React from 'react';
import { RefreshCw, X } from 'lucide-react';

interface ReloadPromptProps {
    needRefresh: boolean;
    offlineReady: boolean;
    onReload: () => void;
    onClose: () => void;
}

const ReloadPrompt: React.FC<ReloadPromptProps> = ({ needRefresh, offlineReady, onReload, onClose }) => {
    if (!needRefresh && !offlineReady) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="bg-slate-800 border border-slate-700 text-white p-4 rounded-xl shadow-2xl flex flex-col gap-3 max-w-xs md:max-w-sm">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-bold text-sm mb-1">
                            {needRefresh ? "Mise à jour disponible" : "Mode Hors Ligne prêt"}
                        </h3>
                        <p className="text-xs text-slate-400">
                            {needRefresh
                                ? "Une nouvelle version avec les correctifs est disponible."
                                : "L'application peut maintenant fonctionner sans internet."}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 dark:text-slate-400 dark:text-white hover:text-emerald-500 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {needRefresh && (
                    <button
                        onClick={() => onReload()}
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={16} className="animate-spin-slow" />
                        Mettre à jour maintenant
                    </button>
                )}
            </div>
        </div>
    );
};

export default ReloadPrompt;
