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
  file: f,
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

const DIST_DIR = path.dirname(OUTPUT);
const DIST_SPECS_DIR = path.join(DIST_DIR, 'specs');
fs.mkdirSync(DIST_SPECS_DIR, { recursive: true });

// 통합 문서 출력
fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
console.log(`Merged spec written to: ${OUTPUT}`);

// 개별 스펙 복사
for (const f of specFiles) {
  fs.copyFileSync(path.join(SPECS_DIR, f), path.join(DIST_SPECS_DIR, f));
}

// Swagger UI index.html 생성
const urls = [
  { url: './openapi.json', name: 'All APIs' },
  ...specFiles.map(f => ({
    url: `./specs/${f}`,
    name: inputs.find(i => i.file === f).oas.info.title
  }))
];

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    SwaggerUIBundle({
      urls: ${JSON.stringify(urls)},
      "urls.primaryName": "All APIs",
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: 'StandaloneLayout'
    });
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html);
console.log(`Swagger UI written to: dist/index.html`);
