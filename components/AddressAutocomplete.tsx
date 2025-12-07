
import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';

interface AddressResult {
  fullAddress: string;
  street: string;
  city: string;
  zipCode: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  onSelect?: (result: AddressResult) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

interface BANFeature {
  properties: {
    label: string;
    score: number;
    housenumber?: string;
    id: string;
    type: string;
    name: string;
    postcode: string;
    citycode: string;
    x: number;
    y: number;
    city: string;
    context: string;
    importance: number;
    street?: string;
  };
  geometry: {
    type: string;
    coordinates: number[];
  };
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  placeholder = "Saisir une adresse...",
  className,
  required = false
}) => {
  const [suggestions, setSuggestions] = useState<BANFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = async (query: string) => {
    onChange(query);

    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      // Use the French Government's official address API (BAN - Base Adresse Nationale)
      const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`);
      const data = await response.json();

      if (data && data.features) {
        setSuggestions(data.features);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("Address search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (feature: BANFeature) => {
    const props = feature.properties;

    const streetLabel = props.street
      ? `${props.housenumber || ''} ${props.street}`.trim()
      : props.name; // Fallback for places that might not have a street field (like hamlets)

    const result: AddressResult = {
      fullAddress: props.label,
      street: streetLabel,
      city: props.city,
      zipCode: props.postcode
    };

    // Update parent
    onChange(result.fullAddress);
    if (onSelect) {
      onSelect(result);
    }

    setShowSuggestions(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <MapPin size={16} className="absolute left-3 top-3 text-emerald-500 z-10 pointer-events-none" />
      <input
        type="text"
        required={required}
        value={value}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading && (
        <div className="absolute right-3 top-3">
          <Loader2 size={16} className="text-slate-400 animate-spin" />
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          <ul className="py-1">
            {suggestions.map((feature, index) => (
              <li
                key={feature.properties.id || index}
                onClick={() => handleSelect(feature)}
                className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex flex-col border-b last:border-0 border-slate-100 dark:border-slate-800/50 transition-colors"
                role="button"
              >
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 dark:text-white">
                  {feature.properties.label}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-white">
                  {feature.properties.context}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
