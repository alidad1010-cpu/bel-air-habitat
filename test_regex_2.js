// Adding word boundaries \b
const dateRegexGlobal =
  /((\b\d{4}[\/\s.-]\d{2}[\/\s.-]\d{2}\b)|(\b\d{2}[\/\s.-]\d{2}[\/\s.-]\d{2,4}\b))/g;

const samples = [
  'P12345 Chantier  15.01.25 20.01.25 Budget 100',
  'P12345 15.01.25 - 20.01.25',
  'P12345 15/01/2025',
  '2025-01-01 starts now',
  'Bad date 2345 15.01', // Should NOT match this as a date from P code
];

samples.forEach((s) => {
  const matches = s.match(dateRegexGlobal);
  console.log(`Sample: "${s}"\nMatches:`, matches);
});
