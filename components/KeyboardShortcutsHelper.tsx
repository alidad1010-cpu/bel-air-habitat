import React, { useState } from 'react';
import { Keyboard, X } from 'lucide-react';

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const KeyboardShortcutsHelper: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const shortcuts: Shortcut[] = [
    { keys: ['Ctrl', 'K'], description: 'Recherche universelle', category: 'Navigation' },
    { keys: ['Ctrl', 'N'], description: 'Nouveau projet', category: 'Actions' },
    { keys: ['Ctrl', 'S'], description: 'Sauvegarder', category: 'Actions' },
    { keys: ['Ctrl', 'P'], description: 'Imprimer/Exporter PDF', category: 'Actions' },
    { keys: ['Ctrl', 'D'], description: 'Tableau de bord', category: 'Navigation' },
    { keys: ['Ctrl', 'T'], description: 'Mes tâches', category: 'Navigation' },
    { keys: ['Ctrl', 'C'], description: 'Clients', category: 'Navigation' },
    { keys: ['Ctrl', 'E'], description: 'Salariés', category: 'Navigation' },
    { keys: ['Esc'], description: 'Fermer modal/panneau', category: 'Navigation' },
    { keys: ['?'], description: 'Afficher les raccourcis', category: 'Aide' },
  ];

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="hidden md:flex fixed top-20 right-6 z-40 p-2.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg shadow-md hover:shadow-lg hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-all duration-200"
        title="Raccourcis clavier (Shift + ?)"
      >
        <Keyboard size={18} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card max-w-2xl w-full mx-4 p-8 border-2 border-purple-300 dark:border-purple-800 shadow-2xl shadow-purple-500/30 animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                ⌨️ Raccourcis Clavier
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              {categories.map(category => (
                <div key={category}>
                  <h3 className="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-3">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {shortcuts
                      .filter(s => s.category === category)
                      .map((shortcut, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
                        >
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {shortcut.description}
                          </span>
                          <div className="flex gap-1">
                            {shortcut.keys.map((key, i) => (
                              <React.Fragment key={i}>
                                <kbd className="px-3 py-1 bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs font-bold rounded shadow-lg">
                                  {key}
                                </kbd>
                                {i < shortcut.keys.length - 1 && (
                                  <span className="text-slate-400 mx-1">+</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
                💡 <strong>Astuce :</strong> Appuyez sur <kbd className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded">Shift</kbd> + <kbd className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded">?</kbd> pour afficher/masquer ce panneau
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KeyboardShortcutsHelper;
