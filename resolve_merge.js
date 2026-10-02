const { execSync } = require('child_process');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8' });
  } catch (e) {
    console.error(e.stdout);
    console.error(e.stderr);
    return null;
  }
}

const status = run('git status --porcelain');
if (!status) process.exit(1);

const unmerged = status.split('\n').filter(line => line.startsWith('UU ') || line.startsWith('DU ') || line.startsWith('UD ') || line.startsWith('DD ') || line.startsWith('AA ') || line.startsWith('AU ') || line.startsWith('UA ')).map(line => line.slice(3).trim());

const keepTheirs = [
  'admin/drizzle.config.ts',
  'admin/lib/db.ts',
  'admin/lib/relations.ts',
  'admin/lib/schema.ts',
  'admin/lib/arcjet.ts',
  'api/drizzle.config.ts',
  'api/lib/db.ts',
  'api/lib/relations.ts',
  'api/lib/schema.ts',
  'api/app/api/cron/cleanup/route.ts',
  'api/app/api/webhooks/paystack/route.ts',
  'admin/app/api/paystack/webhook/route.ts',
];

const keepOurs = [
  'admin/app/(dashboard)/',
  'admin/components/',
  'admin/lib/actions/',
  'public/app/',
  'public/components/',
];

const deleteFiles = [
  'admin/prisma/',
  'api/prisma/',
  'admin/prisma.config.ts',
  'api/prisma.config.ts',
  'admin/lib/prisma.ts',
  'api/lib/prisma.ts',
];

for (const file of unmerged) {
  console.log(`Processing ${file}...`);
  if (keepTheirs.includes(file)) {
    run(`git checkout --theirs "${file}"`);
    run(`git add "${file}"`);
  } else if (keepOurs.some(dir => file.startsWith(dir))) {
    run(`git checkout --ours "${file}"`);
    run(`git add "${file}"`);
  } else if (deleteFiles.some(dir => file.startsWith(dir)) || file === 'admin/prisma.config.ts' || file === 'api/prisma.config.ts') {
    run(`git rm "${file}"`);
  } else {
    console.log(`Skipped ${file}`);
  }
}
