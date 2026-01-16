#!/bin/bash

# Script de Vérification des Modifications
# Ce script montre EXACTEMENT ce qui a changé

echo "🔍 VÉRIFICATION DES MODIFICATIONS - Bel Air Habitat"
echo "=================================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction de vérification
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅ $1 existe${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 MANQUANT${NC}"
        return 1
    fi
}

# Fonction de vérification de contenu
check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✅ $3${NC}"
        return 0
    else
        echo -e "${RED}❌ $3${NC}"
        return 1
    fi
}

echo "📁 1. VÉRIFICATION DES NOUVEAUX FICHIERS"
echo "=========================================="
check_file "contexts/ThemeContext.tsx"
check_file "contexts/AppContext.tsx"
check_file "hooks/useDebounce.ts"
check_file "hooks/useKeyboardShortcuts.ts"
check_file "services/errorService.ts"
check_file "utils/validation.ts"
check_file "components/VirtualizedList.tsx"
check_file "components/Breadcrumbs.tsx"
check_file "components/QuickActions.tsx"
check_file "components/DashboardCharts.tsx"
echo ""

echo "🔧 2. VÉRIFICATION DES MODIFICATIONS DANS LE CODE"
echo "=================================================="
check_content "index.tsx" "ThemeProvider" "index.tsx contient ThemeProvider"
check_content "App.tsx" "useDebounce" "App.tsx utilise useDebounce"
check_content "App.tsx" "useTheme" "App.tsx utilise useTheme"
check_content "App.tsx" "ErrorHandler" "App.tsx utilise ErrorHandler"
check_content "components/Sidebar.tsx" "menuGroups" "Sidebar.tsx contient menuGroups"
check_content "components/Sidebar.tsx" "MON TRAVAIL" "Sidebar.tsx a le label 'MON TRAVAIL'"
check_content "components/Sidebar.tsx" "PROJETS" "Sidebar.tsx a le label 'PROJETS'"
check_content "components/Sidebar.tsx" "RELATIONS" "Sidebar.tsx a le label 'RELATIONS'"
check_content "components/Sidebar.tsx" "FINANCIER" "Sidebar.tsx a le label 'FINANCIER'"
check_content "components/LoginPage.tsx" "ErrorHandler" "LoginPage.tsx utilise ErrorHandler"
check_content "components/ProspectionPage.tsx" "useDebounce" "ProspectionPage.tsx utilise useDebounce"
check_content "components/EmployeesPage.tsx" "useDebounce" "EmployeesPage.tsx utilise useDebounce"
echo ""

echo "📦 3. VÉRIFICATION DES DÉPENDANCES"
echo "===================================="
check_content "package.json" "react-window" "react-window installé"
check_content "package.json" "recharts" "recharts installé"
check_content "package.json" "zod" "zod installé"
echo ""

echo "🌐 4. VÉRIFICATION DU SERVEUR LOCAL"
echo "===================================="
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Serveur local en cours d'exécution (http://localhost:3000)${NC}"
else
    echo -e "${YELLOW}⚠️  Serveur local non démarré. Exécutez: npm run dev${NC}"
fi
echo ""

echo "🔍 5. EXTRACTION DES MODIFICATIONS VISIBLES"
echo "============================================="
echo ""
echo "📋 Voici EXACTEMENT ce qui est dans Sidebar.tsx (lignes 46-80) :"
echo ""
sed -n '46,80p' components/Sidebar.tsx | cat -n
echo ""

echo "📋 Voici EXACTEMENT ce qui est dans index.tsx :"
echo ""
cat index.tsx
echo ""

echo "✅ 6. RÉSUMÉ"
echo "============="
TOTAL=0
SUCCESS=0

# Compter les fichiers
for file in "contexts/ThemeContext.tsx" "hooks/useDebounce.ts" "services/errorService.ts"; do
    TOTAL=$((TOTAL + 1))
    if [ -f "$file" ]; then
        SUCCESS=$((SUCCESS + 1))
    fi
done

echo -e "Fichiers vérifiés: $SUCCESS/$TOTAL"
echo ""

if [ $SUCCESS -eq $TOTAL ]; then
    echo -e "${GREEN}🎉 TOUTES LES MODIFICATIONS SONT PRÉSENTES !${NC}"
    echo ""
    echo "📌 POUR VOIR LES CHANGEMENTS DANS LE NAVIGATEUR :"
    echo "   1. Ouvrir http://localhost:3000/"
    echo "   2. ⚠️  VIDER LE CACHE : Cmd+Shift+R (Mac) ou Ctrl+Shift+R (Windows)"
    echo "   3. Se connecter à l'application"
    echo "   4. Regarder la sidebar - vous verrez les groupes de menus"
    echo ""
else
    echo -e "${RED}⚠️  PROBLÈME DÉTECTÉ${NC}"
    echo "Exécutez: git status"
fi

echo ""
echo "🔗 Liens de Vérification :"
echo "   - Local: http://localhost:3000/"
echo "   - Production: https://bel-air-espace-pro.web.app"
echo "   - GitHub: https://github.com/alidad1010-cpu/bel-air-habitat"
echo ""
