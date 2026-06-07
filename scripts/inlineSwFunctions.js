'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT   = path.join(__dirname, '..');
const SHARED = path.join(ROOT, 'lib', 'utils', 'swShared.js');
const SW     = path.join(ROOT, 'public', 'sw.js');

const START_MARKER = '// <INLINE_START>';
const END_MARKER   = '// <INLINE_END>';

// Read the shared source and strip the ESM export keywords so the functions
// land as plain declarations in the service worker global scope.
const sharedContent = fs.readFileSync(SHARED, 'utf8')
  .replace(/^export\s+/gm, '')   // 'export function foo' → 'function foo'
  .trimEnd();

const swSrc = fs.readFileSync(SW, 'utf8');

const startIdx = swSrc.indexOf(START_MARKER);
const endIdx   = swSrc.indexOf(END_MARKER);

if (startIdx === -1 || endIdx === -1) {
  process.stderr.write(
    'inlineSwFunctions: INLINE_START/INLINE_END markers not found in public/sw.js\n'
  );
  process.exit(1);
}
if (endIdx <= startIdx) {
  process.stderr.write(
    'inlineSwFunctions: INLINE_END appears before or at INLINE_START in public/sw.js\n'
  );
  process.exit(1);
}

const before = swSrc.slice(0, startIdx + START_MARKER.length);
const after  = swSrc.slice(endIdx);
const result = before + '\n' + sharedContent + '\n' + after;

fs.writeFileSync(SW, result, 'utf8');
process.stdout.write('inlineSwFunctions: inlined swShared.js into public/sw.js\n');
