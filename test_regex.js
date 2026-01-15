const dateRegexGlobal = /((\d{4}[\/\s.-]\d{2}[\/\s.-]\d{2})|(\d{2}[\/\s.-]\d{2}[\/\s.-]\d{2,4}))/g;

const samples = [
  'P12345 Chantier Test 15.01.25 20.01.25 Budget 100',
  'P12345 Chantier Test 15/01/2025 20/01/2025',
  'P12345 Chantier Test 15 01 25 20 01 25',
  'P12345 Chantier Test 15.01.2025 20.01.2025',
  'P12345 15.01.25 - 20.01.25',
];

samples.forEach((s) => {
  const matches = s.match(dateRegexGlobal);
  console.log(`Sample: "${s}"\nMatches:`, matches);
});
