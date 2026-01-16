/**
 * Hook useKeyboardShortcuts
 * Gestion des raccourcis clavier pour améliorer la productivité
 */
import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlOrCmd?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description?: string;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

/**
 * Hook pour gérer les raccourcis clavier
 * @param shortcuts - Liste des raccourcis à écouter
 * @param enabled - Si false, désactive les raccourcis (défaut: true)
 */
export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignorer si on est dans un input, textarea ou contenu éditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        (target.tagName === 'BUTTON' && event.key !== 'Escape')
      ) {
        // Permettre Escape partout et certains raccourcis spécifiques
        if (event.key !== 'Escape' && event.key !== 'Enter' && !event.key.startsWith('Arrow')) {
          return;
        }
      }

      shortcuts.forEach((shortcut) => {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase() || event.code === shortcut.key;
        if (!keyMatches) return;

        // Vérifier les modificateurs
        const ctrlOrCmdMatch = shortcut.ctrlOrCmd !== undefined 
          ? (shortcut.ctrlOrCmd ? (event.ctrlKey || event.metaKey) : (!event.ctrlKey && !event.metaKey))
          : true; // Si non spécifié, ignorer cette condition
        
        const shiftMatch = shortcut.shift !== undefined
          ? (shortcut.shift ? event.shiftKey : !event.shiftKey)
          : true;
        
        const altMatch = shortcut.alt !== undefined
          ? (shortcut.alt ? event.altKey : !event.altKey)
          : true;

        if (ctrlOrCmdMatch && shiftMatch && altMatch) {
          event.preventDefault();
          event.stopPropagation();
          shortcut.action();
        }
      });
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}

/**
 * Raccourcis standards recommandés
 */
export const StandardShortcuts = {
  SEARCH: 'k',
  NEW_PROJECT: 'n',
  NEW_CLIENT: 'p',
  SETTINGS: ',',
  HELP: '/',
  ESCAPE: 'Escape',
} as const;
