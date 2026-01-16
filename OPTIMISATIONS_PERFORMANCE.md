# Optimisations de Performance pour Bel Air Habitat

## 🚀 Améliorations de Fluidité

Ce document répertorie toutes les optimisations recommandées pour améliorer la fluidité et les performances de l'application.

---

## ✅ Optimisations Déjà Appliquées

1. **ClientsPage** - Optimisé avec `useMemo` pour le filtrage et `React.memo` pour éviter les re-renders inutiles
2. **ProjectList** - Déjà mémorisé avec `React.memo`
3. **ProjectCard** - Déjà mémorisé avec `React.memo`

---

## 📋 Optimisations Recommandées (Par Priorité)

### 🔴 Priorité HAUTE - Impact Immédiat

#### 1. Virtualisation des Listes Longues
**Problème:** Les listes de projets, clients, employés sont rendues en entier même si seule une partie est visible.

**Solution:**
- Implémenter `react-window` ou `react-virtuoso` pour virtualiser les grandes listes
- **Fichiers concernés:**
  - `components/ProjectList.tsx` (table de projets)
  - `components/ClientsPage.tsx` (grille de clients)
  - `components/EmployeesPage.tsx` (liste d'employés)
  - `components/ExpensesPage.tsx` (liste de dépenses)

**Bénéfice:** Réduction de 70-90% du temps de rendu pour les listes de 100+ éléments

```typescript
// Exemple avec react-window
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={filteredClients.length}
  itemSize={200}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <ClientCard client={filteredClients[index]} />
    </div>
  )}
</FixedSizeList>
```

#### 2. Optimiser les Calculs Coûteux dans Dashboard
**Problème:** Les statistiques du dashboard sont recalculées à chaque render.

**Solution:**
- Mémoriser les calculs de statistiques avec `useMemo`
- **Fichier:** `components/Dashboard.tsx`

**Bénéfice:** Réduction de 50-80% du temps de calcul du dashboard

#### 3. Debounce des Recherches
**Problème:** La recherche déclenche des filtres à chaque frappe, causant des lag sur les grandes listes.

**Solution:**
- Ajouter un debounce de 300ms sur toutes les recherches
- **Fichiers concernés:**
  - `App.tsx` (recherche globale)
  - `ClientsPage.tsx` (recherche clients)
  - `EmployeesPage.tsx` (recherche employés)

**Bénéfice:** Réduction des calculs de 70% pendant la saisie

```typescript
// Exemple avec debounce
import { useMemo } from 'react';
import { useDebouncedValue } from './hooks/useDebouncedValue'; // À créer

const debouncedSearch = useDebouncedValue(searchQuery, 300);
const filtered = useMemo(() => {
  return items.filter(item => 
    item.name.toLowerCase().includes(debouncedSearch.toLowerCase())
  );
}, [items, debouncedSearch]);
```

---

### 🟡 Priorité MOYENNE - Amélioration Progressive

#### 4. Code Splitting & Lazy Loading Amélioré
**Problème:** Certains composants lourds sont chargés même s'ils ne sont pas utilisés.

**Solution:**
- Vérifier que tous les composants volumineux sont lazy-loaded
- **Fichier:** `App.tsx`

**Status:** Déjà partiellement implémenté, mais peut être amélioré

#### 5. Mémorisation des Composants Enfants
**Problème:** Les composants enfants se re-rendent même si leurs props n'ont pas changé.

**Solution:**
- Ajouter `React.memo` aux composants suivants:
  - `components/Dashboard/StatCard.tsx` (déjà partiellement fait)
  - `components/NotificationDropdown.tsx`
  - `components/Sidebar.tsx`
  - `components/UserProfileModal.tsx`

**Bénéfice:** Réduction de 30-50% des re-renders inutiles

#### 6. Optimiser les Images
**Problème:** Les images sont chargées sans lazy loading ni compression.

**Solution:**
- Implémenter `loading="lazy"` sur toutes les images
- Utiliser `srcset` pour les images responsives
- Compresser les images lors de l'upload

**Fichiers concernés:**
- Tous les composants qui affichent des images (ProjectDetail, ClientsPage, etc.)

---

### 🟢 Priorité BASSE - Optimisations Futures

#### 7. Service Worker & Cache Strategy
**Problème:** Le cache pourrait être plus agressif pour les données statiques.

**Solution:**
- Améliorer la stratégie de cache dans `vite.config.ts`
- Pré-cache les assets critiques

#### 8. Bundle Size Optimization
**Problème:** Le bundle JavaScript pourrait être réduit.

**Solution:**
- Analyser le bundle avec `vite-bundle-visualizer`
- Implémenter tree-shaking pour les bibliothèques volumineuses

#### 9. Memory Leaks Prevention
**Problème:** Les subscriptions Firebase pourraient ne pas être nettoyées correctement.

**Solution:**
- Vérifier tous les `useEffect` avec cleanup functions
- Utiliser des outils de profilage pour détecter les fuites mémoire

---

## 🔧 Optimisations Techniques Spécifiques

### App.tsx - Optimisations Critiques

1. **Mémoriser les callbacks:**
```typescript
// ❌ AVANT
const handleProjectSelect = (project: Project) => setSelectedProject(project);

// ✅ APRÈS
const handleProjectSelect = useCallback(
  (project: Project) => setSelectedProject(project),
  []
);
```

2. **Mémoriser les valeurs dérivées:**
```typescript
// ✅ Déjà fait pour filteredAndSortedProjects, continuer pour autres
const totalPages = useMemo(
  () => Math.ceil(filteredAndSortedProjects.length / itemsPerPage),
  [filteredAndSortedProjects.length, itemsPerPage]
);
```

3. **Optimiser les effets:**
```typescript
// Ajouter des dépendances exactes pour éviter les exécutions inutiles
useEffect(() => {
  // Code
}, [/* dépendances exactes uniquement */]);
```

### ProjectDetail.tsx - Optimisations

1. **Virtualiser la liste des documents/photos**
2. **Mémoriser les calculs de dates**
3. **Lazy load les modales**

### EmployeesPage.tsx - Optimisations

1. **Virtualiser le tableau d'attendance**
2. **Mémoriser les calculs de totaux**
3. **Optimiser le rendu conditionnel**

---

## 📊 Métriques de Performance à Surveiller

### Before/After Metrics
- **First Contentful Paint (FCP):** < 1.5s (actuellement ~2-3s)
- **Time to Interactive (TTI):** < 3s (actuellement ~4-5s)
- **Largest Contentful Paint (LCP):** < 2.5s
- **Cumulative Layout Shift (CLS):** < 0.1

### Tools de Mesure
- Lighthouse (Chrome DevTools)
- React DevTools Profiler
- Performance API du navigateur

---

## 🎯 Plan d'Implémentation Recommandé

### Semaine 1: Quick Wins
- ✅ ClientsPage optimisé
- [ ] Debounce des recherches
- [ ] React.memo sur composants enfants

### Semaine 2: Optimisations Majeures
- [ ] Virtualisation des listes
- [ ] Optimisation Dashboard
- [ ] Lazy loading images

### Semaine 3: Optimisations Avancées
- [ ] Bundle optimization
- [ ] Service Worker improvements
- [ ] Memory leak fixes

---

## 💡 Bonnes Pratiques Générales

1. **Toujours utiliser `useMemo` pour:**
   - Calculs coûteux (filtres, tris, agrégations)
   - Valeurs dérivées de grandes listes
   - Création d'objets/tableaux complexes

2. **Toujours utiliser `useCallback` pour:**
   - Callbacks passés aux composants enfants
   - Handlers d'événements dans les listes
   - Fonctions dans les dépendances de `useEffect`

3. **Toujours utiliser `React.memo` pour:**
   - Composants qui reçoivent souvent les mêmes props
   - Composants enfants dans des listes
   - Composants de présentation purs

4. **Éviter:**
   - Création d'objets/fonctions dans le render
   - Re-renders inutiles avec des props qui changent à chaque render
   - Calculs synchrones lourds dans le render

---

## 📝 Notes

- Toutes les optimisations doivent être mesurées avant/après
- Utiliser React DevTools Profiler pour identifier les bottlenecks
- Prioriser les optimisations qui impactent l'expérience utilisateur
- Ne pas sur-optimiser au détriment de la lisibilité du code
