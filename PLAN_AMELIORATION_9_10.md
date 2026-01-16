# 🎯 Plan d'Amélioration : 6.3/10 → 9/10

**Objectif:** Améliorer le score global à au minimum 9/10  
**Durée estimée:** 2-3 semaines de développement  
**Priorité:** Par impact sur le score

---

## 📊 Objectifs par Catégorie

| Catégorie | Score Actuel | Score Cible | Amélioration Requise |
|-----------|--------------|-------------|---------------------|
| **Sécurité** | 6/10 | 9/10 | +3 points |
| **Performance** | 7/10 | 9/10 | +2 points |
| **Code Quality** | 7/10 | 9/10 | +2 points |
| **Architecture** | 8/10 | 9/10 | +1 point |
| **Tests** | 4/10 | 9/10 | +5 points |
| **Documentation** | 6/10 | 8/10 | +2 points |

---

## 🔴 PHASE 1: SÉCURITÉ (6/10 → 9/10)

### 1.1 Retirer Credentials Hardcodées ⚠️ CRITIQUE
**Impact:** +1.5 points | **Effort:** 30 min | **Priorité:** URGENT

**Fichier:** `services/firebaseService.ts`

```typescript
// ❌ AVANT
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSy...', // Hardcodé
  // ...
};

// ✅ APRÈS
const getFirebaseConfig = () => {
  const required = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ];

  const missing = required.filter(key => !import.meta.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing Firebase config: ${missing.join(', ')}`);
  }

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
};
```

**Actions:**
- [ ] Retirer tous les fallbacks hardcodés
- [ ] Ajouter validation des variables d'environnement
- [ ] Créer `.env.example` avec tous les champs requis
- [ ] Ajouter vérification au démarrage de l'app

---

### 1.2 Renforcer Règles Firestore ⚠️ CRITIQUE
**Impact:** +1.0 point | **Effort:** 2h | **Priorité:** URGENT

**Fichier:** `firestore.rules`

```javascript
// ✅ NOUVELLES RÈGLES SÉCURISÉES

// Helper: Vérifie si l'utilisateur est propriétaire
function isOwner(userId) {
  return isAuthenticated() && request.auth.uid == userId;
}

// Helper: Vérifie si l'utilisateur est admin
function isAdmin() {
  return isAuthenticated() && (
    request.auth.token.role == 'ADMIN' ||
    exists(/databases/$(database)/documents/admins/$(request.auth.uid))
  );
}

// PROJECTS: Seulement les utilisateurs authentifiés peuvent créer/lire
// Propriétaires peuvent modifier/supprimer
match /projects/{projectId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() && request.resource.data.createdBy == request.auth.uid;
  allow update: if isAuthenticated() && (
    resource.data.createdBy == request.auth.uid ||
    isAdmin()
  );
  allow delete: if isAuthenticated() && (
    resource.data.createdBy == request.auth.uid ||
    isAdmin()
  );
}

// CLIENTS: Lecture pour tous, écriture limitée
match /clients/{clientId} {
  allow read: if isAuthenticated();
  allow create, update, delete: if isAuthenticated() && (
    request.auth.token.role == 'ADMIN' ||
    resource.data.createdBy == request.auth.uid
  );
}

// EMPLOYEES: Seulement admins peuvent modifier
match /employees/{employeeId} {
  allow read: if isAuthenticated();
  allow write: if isAdmin();
}

// EXPENSES: Propriétaires seulement
match /expenses/{expenseId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() && request.resource.data.createdBy == request.auth.uid;
  allow update, delete: if isAuthenticated() && (
    resource.data.createdBy == request.auth.uid ||
    isAdmin()
  );
}
```

**Actions:**
- [ ] Ajouter vérifications de propriétaire pour toutes les collections
- [ ] Limiter accès admin aux données sensibles
- [ ] Ajouter validation des champs dans les règles
- [ ] Tester toutes les règles avec emulator

---

### 1.3 Validation Inputs avec Zod ⚠️ IMPORTANT
**Impact:** +0.5 point | **Effort:** 4h | **Priorité:** HAUTE

**Installation:**
```bash
npm install zod
```

**Créer:** `utils/validation.ts`

```typescript
import { z } from 'zod';

// Schémas de validation
export const ProjectSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  client: z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }),
  status: z.enum(['NOUVEAU', 'EN_COURS', 'DEVIS_ENVOYE', 'VALIDE', 'TERMINE', 'ANNULE', 'PERDU', 'EN_VALIDATION', 'REFUSE']),
  budget: z.number().min(0).optional(),
  createdAt: z.number(),
});

export const ClientSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  type: z.enum(['PARTICULIER', 'ENTREPRISE', 'ARCHITECTE', 'SYNDIC', 'SOUS_TRAITANT', 'PARTENAIRE', 'BAILLEUR', 'SCI']).optional(),
});

// Helper pour valider avec messages d'erreur
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { success: false, errors: ['Validation error'] };
  }
}
```

**Utilisation dans les formulaires:**
```typescript
const handleSubmit = (data: any) => {
  const validation = validate(ProjectSchema, data);
  if (!validation.success) {
    alert(`Erreurs de validation:\n${validation.errors.join('\n')}`);
    return;
  }
  // Utiliser validation.data qui est typé correctement
  onSave(validation.data);
};
```

**Actions:**
- [ ] Installer Zod
- [ ] Créer schémas pour tous les types principaux
- [ ] Valider tous les inputs utilisateur
- [ ] Valider les données avant envoi à Firebase
- [ ] Ajouter messages d'erreur utilisateur-friendly

---

## ⚡ PHASE 2: PERFORMANCE (7/10 → 9/10)

### 2.1 Virtualiser les Listes ⚠️ HAUTE PRIORITÉ
**Impact:** +1.0 point | **Effort:** 6h | **Priorité:** HAUTE

**Installation:**
```bash
npm install react-window @types/react-window
```

**Composant:** `components/VirtualizedList.tsx`

```typescript
import { FixedSizeList, ListChildComponentProps } from 'react-window';

interface VirtualizedListProps<T> {
  items: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
}

export function VirtualizedList<T>({ items, height, itemHeight, renderItem }: VirtualizedListProps<T>) {
  const Row = ({ index, style }: ListChildComponentProps) => (
    <div style={style}>
      {renderItem(items[index], index)}
    </div>
  );

  return (
    <FixedSizeList
      height={height}
      itemCount={items.length}
      itemSize={itemHeight}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

**Mise à jour:** `components/ProjectList.tsx`

```typescript
// Utiliser VirtualizedList au lieu de .map()
<VirtualizedList
  items={projects}
  height={600}
  itemHeight={80}
  renderItem={(project, index) => (
    <tr key={project.id} /* ... */>
      {/* ... */}
    </tr>
  )}
/>
```

**Mise à jour:** `components/ClientsPage.tsx`

```typescript
// Pour la grille, utiliser react-window Grid
import { FixedSizeGrid } from 'react-window';

<FixedSizeGrid
  columnCount={3}
  columnWidth={350}
  height={600}
  rowCount={Math.ceil(filteredClients.length / 3)}
  rowHeight={250}
  width="100%"
>
  {({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * 3 + columnIndex;
    if (index >= filteredClients.length) return null;
    return (
      <div style={style}>
        <ClientCard client={filteredClients[index]} />
      </div>
    );
  }}
</FixedSizeGrid>
```

**Actions:**
- [ ] Installer react-window
- [ ] Créer composant VirtualizedList
- [ ] Virtualiser ProjectList
- [ ] Virtualiser ClientsPage (grille)
- [ ] Virtualiser EmployeesPage (tableau)
- [ ] Tester avec 1000+ éléments

---

### 2.2 Debounce des Recherches ⚠️ HAUTE PRIORITÉ
**Impact:** +0.5 point | **Effort:** 2h | **Priorité:** HAUTE

**Créer:** `hooks/useDebounce.ts`

```typescript
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

**Utilisation:**

```typescript
// App.tsx
const debouncedSearchQuery = useDebounce(searchQuery, 300);

useEffect(() => {
  handleGlobalSearch(debouncedSearchQuery);
}, [debouncedSearchQuery, projects, clients]);

// ClientsPage.tsx
const debouncedSearch = useDebounce(searchQuery, 300);
const filteredClients = useMemo(() => {
  // Utiliser debouncedSearch au lieu de searchQuery
}, [clients, debouncedSearch]);
```

**Actions:**
- [ ] Créer hook useDebounce
- [ ] Appliquer à recherche globale (App.tsx)
- [ ] Appliquer à ClientsPage
- [ ] Appliquer à EmployeesPage
- [ ] Appliquer à toutes les autres pages avec recherche

---

### 2.3 Optimiser Dashboard ⚠️ MOYENNE PRIORITÉ
**Impact:** +0.5 point | **Effort:** 3h | **Priorité:** MOYENNE

**Fichier:** `components/Dashboard.tsx`

```typescript
// Mémoriser TOUS les calculs de stats
const stats = useMemo(() => {
  const counts = {
    available: 0,
    applied: 0,
    declined: 0,
    upcoming: 0,
    inProgress: 0,
    late: 0,
    validating: 0,
    finished: 0,
    refused: 0,
  };

  projects.forEach(project => {
    // ... calculs optimisés
  });

  return counts;
}, [projects]); // Seulement recalculer si projects change

// Mémoriser projets filtrés
const recentProjects = useMemo(() => {
  return projects
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 5);
}, [projects]);
```

**Actions:**
- [ ] Mémoriser tous les calculs avec useMemo
- [ ] Optimiser les filtres et tris
- [ ] Réduire les recalculs inutiles
- [ ] Tester les performances avant/après

---

## 💻 PHASE 3: CODE QUALITY (7/10 → 9/10)

### 3.1 Découper ProjectDetail.tsx ⚠️ IMPORTANT
**Impact:** +0.5 point | **Effort:** 8h | **Priorité:** MOYENNE

**Structure proposée:**

```
components/ProjectDetail/
├── ProjectDetail.tsx (main, ~200 lignes)
├── ProjectInfoTab.tsx (~200 lignes)
├── ProjectTasksTab.tsx (~150 lignes)
├── ProjectDocumentsTab.tsx (~200 lignes)
├── ProjectPhotosTab.tsx (~200 lignes)
├── ProjectInvoicesTab.tsx (~150 lignes)
├── ProjectAppointmentsTab.tsx (~150 lignes)
├── ProjectExpensesTab.tsx (~150 lignes)
├── ProjectBDCTab.tsx (~200 lignes)
└── hooks/
    ├── useProjectForm.ts (~100 lignes)
    └── useProjectData.ts (~100 lignes)
```

**Actions:**
- [ ] Créer structure de dossiers
- [ ] Extraire chaque onglet en composant séparé
- [ ] Créer hooks personnalisés pour logique
- [ ] Tester chaque composant indépendamment
- [ ] Documenter les props et responsabilités

---

### 3.2 Réduire Utilisation de `any` ⚠️ MOYENNE PRIORITÉ
**Impact:** +0.5 point | **Effort:** 6h | **Priorité:** MOYENNE

**Stratégie:**
1. Identifier tous les `any` (actuellement ~45)
2. Créer types manquants
3. Utiliser `unknown` comme type de secours
4. Valider avec Zod pour runtime type safety

**Exemple:**

```typescript
// ❌ AVANT
const sanitizeStorageData = (data: any, ...): any => { ... }

// ✅ APRÈS
type SerializableValue = 
  | string 
  | number 
  | boolean 
  | null 
  | SerializableObject 
  | SerializableArray;

interface SerializableObject {
  [key: string]: SerializableValue;
}

type SerializableArray = SerializableValue[];

const sanitizeStorageData = (
  data: unknown, 
  ancestors = new Set<object>(), 
  depth = 0
): SerializableValue => { ... }
```

**Actions:**
- [ ] Auditer tous les `any`
- [ ] Créer types pour chaque cas
- [ ] Remplacer par types appropriés
- [ ] Utiliser `unknown` comme fallback
- [ ] Objectif: < 10 occurrences de `any`

---

### 3.3 Centraliser Gestion des Erreurs ⚠️ MOYENNE PRIORITÉ
**Impact:** +1.0 point | **Effort:** 4h | **Priorité:** MOYENNE

**Créer:** `services/errorService.ts`

```typescript
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  VALIDATION = 'VALIDATION',
  FIRESTORE = 'FIRESTORE',
  STORAGE = 'STORAGE',
  UNKNOWN = 'UNKNOWN',
}

export interface AppError {
  type: ErrorType;
  message: string;
  code?: string;
  originalError?: unknown;
  timestamp: number;
}

export class ErrorHandler {
  static handle(error: unknown, context?: string): AppError {
    const appError: AppError = {
      type: ErrorType.UNKNOWN,
      message: 'Une erreur est survenue',
      timestamp: Date.now(),
      originalError: error,
    };

    // Gérer différents types d'erreurs
    if (error instanceof Error) {
      appError.message = error.message;
    }

    // Logger en développement
    if (import.meta.env.DEV) {
      console.error(`[${context || 'Error'}]`, appError);
    }

    // Envoyer à service de logging en production
    if (import.meta.env.PROD) {
      // this.logToService(appError);
    }

    return appError;
  }

  static showUserFriendly(error: AppError): string {
    switch (error.type) {
      case ErrorType.NETWORK:
        return 'Problème de connexion. Vérifiez votre internet.';
      case ErrorType.AUTH:
        return 'Erreur d\'authentification. Veuillez vous reconnecter.';
      case ErrorType.VALIDATION:
        return `Données invalides: ${error.message}`;
      default:
        return 'Une erreur est survenue. Veuillez réessayer.';
    }
  }
}
```

**Actions:**
- [ ] Créer ErrorHandler service
- [ ] Remplacer tous les try/catch silencieux
- [ ] Afficher messages utilisateur-friendly
- [ ] Logger erreurs en production (optionnel)

---

## 🧪 PHASE 4: TESTS (4/10 → 9/10)

### 4.1 Tests pour Services Critiques ⚠️ HAUTE PRIORITÉ
**Impact:** +2.0 points | **Effort:** 8h | **Priorité:** HAUTE

**Créer:** `tests/services/firebaseService.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveDocument, subscribeToCollection } from '../../services/firebaseService';

describe('firebaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveDocument', () => {
    it('should save document successfully', async () => {
      const mockData = { id: '123', name: 'Test' };
      await expect(saveDocument('test', '123', mockData)).resolves.not.toThrow();
    });

    it('should handle errors gracefully', async () => {
      // Mock error scenario
      // Test error handling
    });
  });

  describe('subscribeToCollection', () => {
    it('should subscribe and return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToCollection('test', callback);
      expect(typeof unsubscribe).toBe('function');
    });
  });
});
```

**Créer:** `tests/services/geminiService.test.ts`

```typescript
// Tests pour extraction de projets
// Tests pour analyse de dépenses
// Tests pour gestion d'erreurs API
```

**Actions:**
- [ ] Tests pour firebaseService
- [ ] Tests pour geminiService
- [ ] Tests pour emailService
- [ ] Tests pour pdfService
- [ ] Objectif: 80%+ couverture des services

---

### 4.2 Tests pour Composants Principaux ⚠️ HAUTE PRIORITÉ
**Impact:** +2.0 points | **Effort:** 10h | **Priorité:** HAUTE

**Exemple:** `tests/components/ProjectList.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProjectList from '../../components/ProjectList';

describe('ProjectList', () => {
  const mockProjects = [
    { id: '1', title: 'Test Project', status: 'NEW', /* ... */ },
    // ...
  ];

  it('should render projects list', () => {
    render(<ProjectList projects={mockProjects} onSelect={vi.fn()} />);
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('should call onSelect when project clicked', () => {
    const onSelect = vi.fn();
    render(<ProjectList projects={mockProjects} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Test Project'));
    expect(onSelect).toHaveBeenCalledWith(mockProjects[0]);
  });
});
```

**Actions:**
- [ ] Tests pour ProjectList
- [ ] Tests pour ClientsPage
- [ ] Tests pour Dashboard
- [ ] Tests pour LoginPage
- [ ] Tests pour ProjectDetail (par onglet)
- [ ] Objectif: 70%+ couverture des composants

---

### 4.3 Tests E2E avec Playwright ⚠️ MOYENNE PRIORITÉ
**Impact:** +1.0 point | **Effort:** 6h | **Priorité:** MOYENNE

**Créer:** `tests/e2e/critical-flows.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Critical User Flows', () => {
  test('should login and navigate to dashboard', async ({ page }) => {
    await page.goto('/');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/#dashboard');
  });

  test('should create a new project', async ({ page }) => {
    // Test complet du flow de création
  });

  test('should search and filter projects', async ({ page }) => {
    // Test recherche et filtres
  });
});
```

**Actions:**
- [ ] Tests E2E pour login
- [ ] Tests E2E pour création projet
- [ ] Tests E2E pour recherche
- [ ] Tests E2E pour navigation
- [ ] Intégrer dans CI/CD

---

## 🏗️ PHASE 5: ARCHITECTURE (8/10 → 9/10)

### 5.1 State Management Centralisé ⚠️ MOYENNE PRIORITÉ
**Impact:** +1.0 point | **Effort:** 6h | **Priorité:** MOYENNE

**Créer:** `contexts/AppContext.tsx`

```typescript
import { createContext, useContext, useReducer, ReactNode } from 'react';

interface AppState {
  user: User | null;
  projects: Project[];
  clients: Client[];
  // ...
}

type AppAction = 
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  // ...

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<AppAction> } | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
```

**Actions:**
- [ ] Créer AppContext
- [ ] Migrer état global de App.tsx
- [ ] Réduire props drilling
- [ ] Tester avec DevTools

---

## 📝 PHASE 6: DOCUMENTATION (6/10 → 8/10)

### 6.1 Documentation Inline ⚠️ BASSE PRIORITÉ
**Impact:** +1.0 point | **Effort:** 4h | **Priorité:** BASSE

**Stratégie:**
- Ajouter JSDoc aux fonctions complexes
- Documenter les props des composants
- Expliquer les décisions architecturales

**Actions:**
- [ ] JSDoc pour toutes les fonctions publiques
- [ ] Documentation des interfaces
- [ ] README mis à jour
- [ ] Guide de contribution

---

## 📅 Timeline Recommandé

### Semaine 1: Sécurité + Performance Quick Wins
- ✅ Retirer credentials hardcodées (30 min)
- ✅ Renforcer règles Firestore (2h)
- ✅ Ajouter validation Zod (4h)
- ✅ Debounce recherches (2h)
- ✅ Virtualiser ProjectList (3h)

### Semaine 2: Performance + Code Quality
- ✅ Virtualiser ClientsPage et EmployeesPage (3h)
- ✅ Optimiser Dashboard (3h)
- ✅ Réduire `any` (6h)
- ✅ Centraliser gestion erreurs (4h)
- ✅ Découper ProjectDetail (4h)

### Semaine 3: Tests + Architecture
- ✅ Tests services (8h)
- ✅ Tests composants (10h)
- ✅ Tests E2E (6h)
- ✅ State management centralisé (6h)
- ✅ Documentation (4h)

---

## ✅ Checklist Complète

### Sécurité (9/10)
- [ ] Retirer credentials hardcodées
- [ ] Renforcer règles Firestore
- [ ] Validation inputs avec Zod
- [ ] Logger conditionnel (dev seulement)
- [ ] Audit dépendances npm

### Performance (9/10)
- [ ] Virtualiser toutes les listes
- [ ] Debounce toutes les recherches
- [ ] Optimiser Dashboard avec useMemo
- [ ] Lazy load images
- [ ] Bundle optimization

### Code Quality (9/10)
- [ ] Découper ProjectDetail
- [ ] Réduire `any` à < 10
- [ ] Centraliser gestion erreurs
- [ ] Découper EmployeesPage
- [ ] Refactoriser App.tsx

### Tests (9/10)
- [ ] Tests services (80%+ couverture)
- [ ] Tests composants (70%+ couverture)
- [ ] Tests E2E critiques
- [ ] Tests d'intégration
- [ ] CI/CD avec tests

### Architecture (9/10)
- [ ] State management centralisé
- [ ] Service layer abstrait
- [ ] Error boundaries améliorés
- [ ] Logging centralisé
- [ ] Monitoring setup

### Documentation (8/10)
- [ ] JSDoc fonctions publiques
- [ ] Documentation interfaces
- [ ] README complet
- [ ] Guide contribution

---

## 🎯 Métriques de Succès

### Avant (Actuel)
- Sécurité: 6/10
- Performance: 7/10
- Code Quality: 7/10
- Architecture: 8/10
- Tests: 4/10
- **Score Global: 6.3/10**

### Après (Objectif)
- Sécurité: 9/10
- Performance: 9/10
- Code Quality: 9/10
- Architecture: 9/10
- Tests: 9/10
- **Score Global: 9.0/10** ✅

---

## 🚀 Quick Wins (Premier Jours)

Si vous voulez des résultats rapides, commencez par:

1. **Retirer credentials hardcodées** (30 min) → +0.5 point
2. **Debounce recherches** (2h) → +0.3 point
3. **Virtualiser ProjectList** (3h) → +0.5 point
4. **Validation Zod** (4h) → +0.5 point

**Total: 9.5h → +1.8 points → Score 8.1/10** 🎉

---

## 📚 Ressources

- [Zod Documentation](https://zod.dev/)
- [react-window Documentation](https://github.com/bvaughn/react-window)
- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)

---

**Note:** Ce plan est ambitieux mais réalisable. Priorisez selon vos besoins business immédiats.
