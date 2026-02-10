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

const output = result.output;

// info 오버라이드
output.info = {
  title: 'Axly API Documentation',
  description: inputs.map(i => `- ${i.oas.info.title}`).join('\n'),
  version: 'v1.0.0'
};

// servers 병합 (중복 URL 제거)
const seenUrls = new Set();
output.servers = inputs.flatMap(i => i.oas.servers || []).filter(s => {
  if (seenUrls.has(s.url)) return false;
  seenUrls.add(s.url);
  return true;
});

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
console.log(`Merged spec written to: ${OUTPUT}`);
