const fs = require('fs');
const path = require('path');
const { merge } = require('openapi-merge');

const SPECS_DIR = path.resolve(__dirname, '..', 'specs');
const OUTPUT = path.resolve(__dirname, '..', 'dist', 'openapi.json');

const specFiles = fs.readdirSync(SPECS_DIR)
  .filter(f => f.endsWith('.json'))
  .sort();

if (specFiles.length === 0) {
  console.error('No spec files found in specs/');
  process.exit(1);
}

console.log(`Found ${specFiles.length} spec(s): ${specFiles.join(', ')}`);

const inputs = specFiles.map(f => ({
  oas: JSON.parse(fs.readFileSync(path.join(SPECS_DIR, f), 'utf-8'))
}));

const result = merge(inputs);

if (result.type === 'err') {
  console.error('Merge failed:', result.message);
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(result.output, null, 2));
console.log(`Merged spec written to: ${OUTPUT}`);
