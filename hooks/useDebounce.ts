/**
 * Hook useDebounce
 * Performance: Réduit les calculs inutiles lors de la saisie
 */
import { useState, useEffect } from 'react';

/**
 * Retourne une valeur déboundée qui se met à jour seulement après un délai
 * @param value - La valeur à débouncer
 * @param delay - Le délai en millisecondes (défaut: 300ms)
 * @returns La valeur déboundée
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Créer un timer qui mettra à jour la valeur déboundée après le délai
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Nettoyer le timer si la valeur change avant la fin du délai
    // Cela évite les mises à jour inutiles
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Réexécuter si value ou delay change

  return debouncedValue;
}
