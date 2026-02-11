/**
 * OpenAPI 스펙 병합 스크립트
 *
 * specs/ 디렉토리에 있는 개별 OpenAPI JSON 파일들을 하나의 통합 문서로 병합하고,
 * Swagger UI를 통해 확인할 수 있는 index.html을 생성한다.
 *
 * 출력 결과물 (dist/):
 *   - openapi.json    : 병합된 통합 OpenAPI 스펙
 *   - specs/*.json    : 개별 스펙 복사본
 *   - index.html      : Swagger UI 페이지
 */

const fs = require('fs');
const path = require('path');
const { merge } = require('openapi-merge');

// 경로 설정
const SPECS_DIR = path.resolve(__dirname, '..', 'specs');       // 개별 스펙 소스 디렉토리
const OUTPUT = path.resolve(__dirname, '..', 'dist', 'openapi.json'); // 병합 결과 출력 경로

// specs/ 디렉토리에서 .json 파일 목록을 읽어 정렬
const specFiles = fs.readdirSync(SPECS_DIR)
  .filter(f => f.endsWith('.json'))
  .sort();

// 스펙 파일이 하나도 없으면 에러 종료
if (specFiles.length === 0) {
  console.error('No spec files found in specs/');
  process.exit(1);
}

console.log(`Found ${specFiles.length} spec(s): ${specFiles.join(', ')}`);

// 각 스펙 파일을 읽어서 { file, oas } 형태의 배열로 변환
const inputs = specFiles.map(f => ({
  file: f,
  oas: JSON.parse(fs.readFileSync(path.join(SPECS_DIR, f), 'utf-8'))
}));

// openapi-merge 라이브러리를 사용하여 스펙 병합 실행
const result = merge(inputs);

// 병합 실패 시 에러 메시지 출력 후 종료
if (result.type === 'err') {
  console.error('Merge failed:', result.message);
  process.exit(1);
}

const output = result.output;

// info 오버라이드: 통합 문서의 제목·설명·버전을 직접 지정
output.info = {
  title: 'Axly API Documentation',
  description: inputs.map(i => `- ${i.oas.info.title}`).join('\n'),
  version: 'v1.0.0'
};

// servers 병합: 각 스펙의 서버 목록을 합치되, 중복 URL은 제거
const seenUrls = new Set();
output.servers = inputs.flatMap(i => i.oas.servers || []).filter(s => {
  if (seenUrls.has(s.url)) return false;
  seenUrls.add(s.url);
  return true;
});

// dist/ 및 dist/specs/ 디렉토리 생성 (이미 존재하면 무시)
const DIST_DIR = path.dirname(OUTPUT);
const DIST_SPECS_DIR = path.join(DIST_DIR, 'specs');
fs.mkdirSync(DIST_SPECS_DIR, { recursive: true });

// 통합 병합 스펙을 JSON 파일로 출력
fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
console.log(`Merged spec written to: ${OUTPUT}`);

// 개별 스펙 파일을 dist/specs/로 복사 (Swagger UI에서 개별 조회 용도)
for (const f of specFiles) {
  fs.copyFileSync(path.join(SPECS_DIR, f), path.join(DIST_SPECS_DIR, f));
}

// Swagger UI에서 사용할 URL 목록 구성
// 첫 번째 항목은 통합 문서, 나머지는 개별 스펙
const urls = [
  { url: './openapi.json', name: 'All APIs' },
  ...specFiles.map(f => ({
    url: `./specs/${f}`,
    name: inputs.find(i => i.file === f).oas.info.title
  }))
];

// Swagger UI index.html 생성
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
