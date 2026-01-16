#!/usr/bin/env node
/**
 * Script de vérification des modifications
 * Vérifie que toutes les modifications sont bien présentes dans les fichiers
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Vérification des modifications...\n');

const checks = [
  {
    name: 'Sidebar avec groupes de menu',
    file: 'components/Sidebar.tsx',
    checks: [
      { pattern: 'MON TRAVAIL', description: 'Label MON TRAVAIL' },
      { pattern: 'PROJETS', description: 'Label PROJETS' },
      { pattern: 'RELATIONS', description: 'Label RELATIONS' },
      { pattern: 'FINANCIER', description: 'Label FINANCIER' },
      { pattern: 'SYSTÈME', description: 'Label SYSTÈME' },
      { pattern: 'menuGroups', description: 'Structure menuGroups' },
    ],
  },
  {
    name: 'ThemeProvider dans index.tsx',
    file: 'index.tsx',
    checks: [
      { pattern: 'ThemeProvider', description: 'Import ThemeProvider' },
      { pattern: 'from \'./contexts/ThemeContext\'', description: 'Import depuis ThemeContext' },
    ],
  },
  {
    name: 'ThemeContext existe',
    file: 'contexts/ThemeContext.tsx',
    checks: [
      { pattern: 'ThemeProvider', description: 'Export ThemeProvider' },
      { pattern: 'useTheme', description: 'Hook useTheme' },
    ],
  },
  {
    name: 'useDebounce hook',
    file: 'hooks/useDebounce.ts',
    checks: [
      { pattern: 'useDebounce', description: 'Fonction useDebounce' },
    ],
  },
  {
    name: 'ErrorHandler utilisé',
    file: 'components/LoginPage.tsx',
    checks: [
      { pattern: 'ErrorHandler', description: 'Import ErrorHandler' },
    ],
  },
];

let allPassed = true;

checks.forEach((check) => {
  const filePath = path.join(__dirname, check.file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${check.name}`);
    console.log(`   Fichier manquant: ${check.file}\n`);
    allPassed = false;
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const failedChecks = [];

  check.checks.forEach(({ pattern, description }) => {
    if (!content.includes(pattern)) {
      failedChecks.push(description);
    }
  });

  if (failedChecks.length === 0) {
    console.log(`✅ ${check.name}`);
  } else {
    console.log(`❌ ${check.name}`);
    failedChecks.forEach((desc) => {
      console.log(`   - Manquant: ${desc}`);
    });
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log('✅ TOUTES LES MODIFICATIONS SONT PRÉSENTES !');
  console.log('\n📝 Prochaines étapes :');
  console.log('   1. Assurez-vous que le serveur tourne : npm run dev');
  console.log('   2. Videz le cache du navigateur (Ctrl+Shift+R ou Cmd+Shift+R)');
  console.log('   3. Ouvrez http://localhost:3000');
  console.log('   4. Regardez la sidebar - vous devriez voir les groupes de menu');
} else {
  console.log('❌ CERTAINES MODIFICATIONS MANQUENT');
  console.log('   Vérifiez les fichiers listés ci-dessus');
}
console.log('='.repeat(50));

process.exit(allPassed ? 0 : 1);
