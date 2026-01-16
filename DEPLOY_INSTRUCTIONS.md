# Instructions de Déploiement

## Prérequis

1. **Node.js installé** (vérifier avec `node --version`)
2. **Firebase CLI installé** (vérifier avec `firebase --version`)
3. **Authentification Firebase** :
   ```bash
   firebase login
   ```

## Méthodes de Déploiement

### Option 1 : Script Automatique (Recommandé)

```bash
./deploy.sh
```

Ce script fait automatiquement :
- Build de l'application (`npm run build`)
- Déploiement Firebase complet (hosting + functions + rules)

### Option 2 : Commande NPM (Hébergement uniquement)

```bash
npm run turbo
```

Déploie uniquement l'hosting (plus rapide, mais ne met pas à jour les functions).

### Option 3 : Déploiement Manuel

#### Étape 1 : Build de l'application
```bash
npm run build
```
Cela crée le dossier `dist/` avec les fichiers optimisés.

#### Étape 2 : Déploiement Firebase

**Déploiement complet** (hosting + functions + rules) :
```bash
firebase deploy --project bel-air-habitat
```

**Déploiement uniquement de l'hosting** (plus rapide) :
```bash
firebase deploy --only hosting --project bel-air-habitat
```

**Déploiement uniquement des functions** :
```bash
firebase deploy --only functions --project bel-air-habitat
```

**Déploiement uniquement des règles Firestore** :
```bash
firebase deploy --only firestore:rules --project bel-air-habitat
```

## Vérification Post-Déploiement

1. Attendez la confirmation Firebase indiquant l'URL de déploiement
2. Visitez l'URL fournie (généralement : `https://bel-air-habitat.web.app` ou similaire)
3. Vérifiez que vos modifications sont bien présentes

## Résolution de Problèmes

### Erreur "Firebase not logged in"
```bash
firebase login
```

### Erreur "Build failed"
- Vérifiez les erreurs de compilation TypeScript
- Exécutez `npm run lint` pour vérifier les erreurs
- Assurez-vous que toutes les dépendances sont installées : `npm install`

### Erreur "Permission denied"
```bash
chmod +x deploy.sh
```

## Configuration Firebase

Le projet est configuré dans `firebase.json` :
- **Hosting** : fichiers dans `dist/`
- **Functions** : dans `functions/`
- **Firestore Rules** : `firestore.rules`
- **Storage Rules** : `storage.rules`

## Notes Importantes

- Le build de production optimise et minifie le code
- Les modifications ne sont pas immédiatement visibles (cache CDN)
- Le premier déploiement peut prendre 2-5 minutes
- Les déploiements suivants sont généralement plus rapides (~30-60 secondes)
