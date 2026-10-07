// Fails the build when the site's JavaScript grows past its budget, so a heavy dependency can't
// slip in unnoticed. Runs after every `npm run build` (the "postbuild" script in package.json)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Gzipped kilobytes. The map loads in its own chunk, so it counts toward the total only
const BUDGET_KB = { main: 70, total: 130 };

const dir = path.join(__dirname, '..', 'build', 'static', 'js');
const sizes = fs
  .readdirSync(dir)
  .filter((file) => file.endsWith('.js'))
  .map((file) => ({ file, kb: zlib.gzipSync(fs.readFileSync(path.join(dir, file))).length / 1024 }));

const main = sizes.find(({ file }) => file.startsWith('main.'));
const total = sizes.reduce((sum, { kb }) => sum + kb, 0);
const problems = [
  main.kb > BUDGET_KB.main && `main bundle is ${main.kb.toFixed(1)} KB gzipped (budget ${BUDGET_KB.main} KB)`,
  total > BUDGET_KB.total && `all JavaScript is ${total.toFixed(1)} KB gzipped (budget ${BUDGET_KB.total} KB)`,
].filter(Boolean);

if (problems.length) {
  console.error(`JavaScript over budget: ${problems.join('; ')}. Look for a new heavy dependency, or raise BUDGET_KB in ${path.relative(process.cwd(), __filename)} if it's worth it.`);
  process.exit(1);
}
console.log(`JavaScript size OK: main ${main.kb.toFixed(1)} KB, total ${total.toFixed(1)} KB gzipped (budgets ${BUDGET_KB.main} and ${BUDGET_KB.total} KB)`);
