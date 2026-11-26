// Checks .github/workflows/*.yml with actionlint (official open-source linter
// for GitHub Actions), run in Docker so nothing needs installing.
// Usage: npm run lint:workflows
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const files = readdirSync('.github/workflows').filter(f => /\.ya?ml$/.test(f)).map(f => `.github/workflows/${f}`);
const result = spawnSync(
  'docker',
  ['run', '--rm', '-v', `${process.cwd()}:/repo`, '-w', '/repo', 'rhysd/actionlint:1.7.7', '-color=false', ...files],
  { stdio: 'inherit' },
);
if (result.status === 0) console.log(`actionlint: ${files.length} workflow file(s) OK`);
process.exit(result.status ?? 1);
