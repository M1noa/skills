#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..');

const DEFAULT_EXCLUDE = new Set([
  'node_modules', '.git', 'dist', 'build', 'vendor', '__pycache__',
  '.next', 'coverage', '.opencode', '.history', 'target', 'obj', 'bin',
  '.venv', 'venv', '.idea', '.vscode', '.cache', '.turbo', '.parcel-cache',
  '.docusaurus', '.nuxt', '.output', '.svelte-kit', '.astro',
]);

const SOURCE_EXTS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py', '.go', '.rs',
  '.java', '.kt', '.swift', '.c', '.cpp', '.cc', '.h', '.hpp', '.cs',
  '.rb', '.php', '.vue', '.svelte', '.sh', '.bash', '.zsh', '.sql',
  '.lua', '.r', '.scala', '.clj', '.ex', '.exs', '.erl', '.hs', '.ml',
  '.fs', '.nim', '.cr', '.zig', '.v', '.d', '.pas', '.pl', '.pm',
  '.json', '.yaml', '.yml', '.toml', '.xml', '.ini', '.env', '.cfg',
  '.dockerfile', '.makefile', '.gradle', '.sbt', '.gemspec',
]);

const CONFIG_FILES = new Set([
  'package.json', 'tsconfig.json', 'jsconfig.json', 'pyproject.toml',
  'setup.py', 'requirements.txt', 'go.mod', 'go.sum', 'Cargo.toml',
  'pom.xml', 'build.gradle', 'build.gradle.kts', 'composer.json',
  'Gemfile', 'Gemfile.lock', 'Dockerfile', 'Makefile', '.env.example',
  '.gitignore', '.dockerignore', '.eslintrc.js', '.eslintrc.json',
  'eslint.config.mjs', '.prettierrc', 'tailwind.config.js',
  'webpack.config.js', 'vite.config.js', 'next.config.js', 'nuxt.config.js',
  'renovate.json', 'dependabot.yml',
]);

const ENTRY_POINTS = new Set([
  'index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts',
  'server.js', 'server.ts', 'main.py', 'app.py', 'wsgi.py', 'asgi.py',
  'main.go', 'main.rs', 'lib.rs', 'main.rs', 'Program.cs', 'Main.cs',
  'index.php', 'artisan', 'server.php',
]);

const CATEGORIES = new Set([
  'security', 'performance', 'dead-code', 'sloppy-code', 'noisy-logs',
  'bad-code', 'optimization', 'improvement', 'qol', 'polish',
]);

const SEVERITIES = new Set([
  'critical', 'high', 'medium', 'low', 'info',
]);

const FIX_PRIORITY = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

const FILES_PER_HOUR = 150;
const BATCH_SIZE = 5;

function priorityFor(rel, dirs) {
  const base = path.basename(rel);
  const topDir = rel.split('/')[0];

  if (ENTRY_POINTS.has(base)) return 0;
  if (CONFIG_FILES.has(base)) return 0;
  if (base === 'Dockerfile' || base === 'Makefile') return 0;
  if (rel.startsWith('config/') || rel.startsWith('configs/')) return 0;
  if (rel.startsWith('utils/') || rel.startsWith('lib/')) return 0;
  if (rel.startsWith('routes/') || rel.startsWith('router/')) return 0;

  const coreDirs = ['src/', 'lib/', 'functions/', 'core/', 'internal/', 'app/'];
  if (coreDirs.some(d => rel.startsWith(d))) return 1;

  const eventDirs = ['events/', 'handlers/', 'middleware/', 'listeners/'];
  if (eventDirs.some(d => rel.startsWith(d))) return 2;

  const testDirs = ['tests/', 'test/', '__tests__', 'spec/', 'e2e/'];
  if (testDirs.some(d => rel.startsWith(d))) return 3;

  if (topDir === 'commands' || topDir === 'controllers' || topDir === 'services') return 2;
  if (topDir === 'models' || topDir === 'schemas') return 2;
  if (topDir === 'scripts' || topDir === 'tools' || topDir === 'bin') return 10;

  return 11;
}

function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

function walk(dir, base, out, excludeDirs, extFilter) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) continue;
      walk(path.join(dir, entry.name), base, out, excludeDirs, extFilter);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const baseName = entry.name;
      if (extFilter && extFilter.size > 0 && !extFilter.has(ext) && !CONFIG_FILES.has(baseName) && !ENTRY_POINTS.has(baseName)) continue;
      if (!extFilter && !SOURCE_EXTS.has(ext) && !CONFIG_FILES.has(baseName) && !ENTRY_POINTS.has(baseName)) continue;
      out.push(path.relative(base, path.join(dir, entry.name)).replace(/\\/g, '/'));
    }
  }
}

function findTracker() {
  const cwdPath = path.join(process.cwd(), 'AUDIT_TRACKER.json');
  if (fs.existsSync(cwdPath)) return cwdPath;
  try {
    const entries = fs.readdirSync(process.cwd(), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subPath = path.join(process.cwd(), entry.name, 'AUDIT_TRACKER.json');
        if (fs.existsSync(subPath)) return subPath;
      }
    }
  } catch {}
  return null;
}

function load(dbPath) {
  if (!dbPath || !fs.existsSync(dbPath)) {
    console.error('No AUDIT_TRACKER.json found. Run: node audit-tracker.cjs init [codebase-path]');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function save(dbPath, db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function findFile(db, p) {
  p = p.replace(/\\/g, '/').replace(/^\.\//, '');
  return db.files.find(f => f.path === p);
}

function printProgress(db) {
  const total = db.files.length;
  const done = db.files.filter(f => f.status === 'done').length;
  const skipped = db.files.filter(f => f.status === 'skipped').length;
  const pending = db.files.filter(f => f.status === 'pending').length;
  const pct = total ? ((done / total) * 100).toFixed(1) : '0.0';
  const findings = db.files.reduce((sum, f) => sum + (f.findings ? f.findings.length : 0), 0);
  console.log(`Progress: ${done}/${total} done (${pct}%) | ${pending} pending | ${skipped} skipped | ${findings} findings`);
}

function printNextBatch(db, count) {
  const next = db.files.filter(f => f.status === 'pending').slice(0, count || BATCH_SIZE);
  if (!next.length) { console.log('All files processed.'); return; }
  console.log('Next batch:');
  for (const f of next) {
    const pri = f.priority <= 0 ? 'CRIT' : f.priority <= 1 ? 'HIGH' : f.priority <= 3 ? 'MED' : 'LOW';
    const loc = f.loc || '?';
    console.log(`  [${pri}] ${f.path} (${loc} lines)`);
  }
}

function cmdInit(args) {
  const root = args[0] ? path.resolve(args[0]) : process.cwd();
  const excludeDirs = new Set(DEFAULT_EXCLUDE);
  let extFilter = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--exclude-dir' && args[i + 1]) {
      excludeDirs.add(args[i + 1]);
      i++;
    }
    if (args[i] === '--ext' && args[i + 1]) {
      extFilter = new Set(args[i + 1].split(',').map(e => e.trim().toLowerCase()));
      i++;
    }
  }

  const files = [];
  walk(root, root, files, excludeDirs, extFilter);
  files.sort((a, b) => {
    const pa = priorityFor(a), pb = priorityFor(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });

  const totalLOC = files.reduce((sum, f) => {
    const loc = countLines(path.join(root, f));
    return sum + loc;
  }, 0);

  const db = {
    codebasePath: root,
    startedAt: new Date().toISOString(),
    batchSize: BATCH_SIZE,
    filesPerHour: FILES_PER_HOUR,
    totalLOC,
    files: files.map(p => ({
      path: p,
      loc: countLines(path.join(root, p)),
      status: 'pending',
      priority: priorityFor(p),
      notes: '',
      findings: [],
      doneAt: null,
      skipReason: null,
    })),
  };

  const dbPath = path.join(root, 'AUDIT_TRACKER.json');
  save(dbPath, db);
  console.log(`Initialized tracker: ${db.files.length} files, ${totalLOC} total LOC.`);
  console.log(`Tracker: ${dbPath}`);
  printProgress(db);

  const hours = Math.ceil(db.files.length / FILES_PER_HOUR);
  console.log(`\nWorkaholic: ~${hours} hour(s) (${db.files.length} files / ${FILES_PER_HOUR} per hour)`);
  console.log(`Run: node audit-tracker.cjs workaholic`);
  console.log(`Then: node audit-tracker.cjs next`);
}

function cmdNext(args) {
  const dbPath = findTracker();
  const db = load(dbPath);
  const count = parseInt(args[0]) || BATCH_SIZE;
  printNextBatch(db, count);
}

function cmdDone(args) {
  const dbPath = findTracker();
  const db = load(dbPath);
  const f = findFile(db, args[0]);
  if (!f) { console.error(`Not in tracker: ${args[0]}`); process.exit(1); }
  f.status = 'done';
  f.doneAt = new Date().toISOString();
  save(dbPath, db);
  printProgress(db);
  printNextBatch(db, BATCH_SIZE);
}

function cmdAddNote(args) {
  const dbPath = findTracker();
  const db = load(dbPath);
  const f = findFile(db, args[0]);
  if (!f) { console.error(`Not in tracker: ${args[0]}`); process.exit(1); }
  const note = args.slice(1).join(' ').trim();
  if (!note) { console.error('Note text required.'); process.exit(1); }
  f.notes = f.notes ? f.notes + '\n' + note : note;
  save(dbPath, db);
  console.log(`Added note to ${args[0]}: ${note.slice(0, 80)}${note.length > 80 ? '...' : ''}`);
}

function cmdAddFinding(args) {
  const dbPath = findTracker();
  const db = load(dbPath);
  const f = findFile(db, args[0]);
  if (!f) { console.error(`Not in tracker: ${args[0]}`); process.exit(1); }

  const category = args[1];
  const severity = args[2];
  const line = parseInt(args[3]) || 0;
  const description = args.slice(4).join(' ').trim();

  if (!CATEGORIES.has(category)) {
    console.error(`Invalid category: ${category}. Valid: ${[...CATEGORIES].join(', ')}`);
    process.exit(1);
  }
  if (!SEVERITIES.has(severity)) {
    console.error(`Invalid severity: ${severity}. Valid: ${[...SEVERITIES].join(', ')}`);
    process.exit(1);
  }
  if (!description) {
    console.error('Description required.');
    process.exit(1);
  }

  f.findings = f.findings || [];
  f.findings.push({ category, severity, line, description, addedAt: new Date().toISOString() });
  save(dbPath, db);
  console.log(`Added finding to ${args[0]}: [${severity}] ${category} L${line}: ${description.slice(0, 80)}`);
}

function cmdSkip(args) {
  const dbPath = findTracker();
  const db = load(dbPath);
  const f = findFile(db, args[0]);
  if (!f) { console.error(`Not in tracker: ${args[0]}`); process.exit(1); }
  f.status = 'skipped';
  f.skipReason = args.slice(1).join(' ').trim() || '';
  save(dbPath, db);
  printProgress(db);
  printNextBatch(db, BATCH_SIZE);
}

function cmdBack(args) {
  const dbPath = findTracker();
  const db = load(dbPath);
  const f = findFile(db, args[0]);
  if (!f) { console.error(`Not in tracker: ${args[0]}`); process.exit(1); }
  f.status = 'pending';
  delete f.doneAt;
  save(dbPath, db);
  console.log(`Reverted ${args[0]} to pending.`);
}

function cmdOverwrite(args) {
  const dbPath = findTracker();
  const db = load(dbPath);
  const f = findFile(db, args[0]);
  if (!f) { console.error(`Not in tracker: ${args[0]}`); process.exit(1); }
  f.status = 'pending';
  delete f.doneAt;
  save(dbPath, db);
  console.log(`Reopened ${args[0]} for re-audit (notes and findings preserved).`);
  printNextBatch(db, BATCH_SIZE);
}

function cmdStatus() {
  const dbPath = findTracker();
  const db = load(dbPath);
  printProgress(db);

  const buckets = {};
  for (const f of db.files) {
    const b = f.priority <= 0 ? 'entry' : f.priority <= 1 ? 'core' : f.priority <= 3 ? 'app' : 'misc';
    buckets[b] = buckets[b] || { done: 0, pending: 0, skipped: 0 };
    buckets[b][f.status]++;
  }
  for (const [b, c] of Object.entries(buckets)) {
    console.log(`  ${b}: ${c.done} done / ${c.pending} pending / ${c.skipped} skipped`);
  }

  const findingsByCat = {};
  let totalFindings = 0;
  for (const f of db.files) {
    for (const finding of (f.findings || [])) {
      findingsByCat[finding.category] = (findingsByCat[finding.category] || 0) + 1;
      totalFindings++;
    }
  }
  if (totalFindings > 0) {
    console.log(`\nFindings by category (${totalFindings} total):`);
    for (const [cat, count] of Object.entries(findingsByCat).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cat}: ${count}`);
    }
  }

  printNextBatch(db, BATCH_SIZE);
}

function cmdWorkaholic() {
  const dbPath = findTracker();
  const db = load(dbPath);
  const minutes = Math.ceil((db.files.length / FILES_PER_HOUR) * 60);
  const hours = (minutes / 60).toFixed(1);
  console.log(`Files: ${db.files.length}`);
  console.log(`Rate: ${FILES_PER_HOUR} files/hour`);
  console.log(`Duration: ${minutes} minutes (${hours} hours)`);
  console.log(`\nCall: workaholic_start(${minutes})`);
}

function cmdExportCsv() {
  const dbPath = findTracker();
  const db = load(dbPath);
  const csvPath = path.join(path.dirname(dbPath), 'AUDIT_TRACKER.csv');

  const rows = ['file,loc,category,severity,line,description'];
  for (const f of db.files) {
    if (!f.findings || f.findings.length === 0) {
      rows.push(`"${f.path}",${f.loc || 0},,,,`);
    } else {
      for (const finding of f.findings) {
        const desc = finding.description.replace(/"/g, '""');
        rows.push(`"${f.path}",${f.loc || 0},${finding.category},${finding.severity},${finding.line},"${desc}"`);
      }
    }
  }

  fs.writeFileSync(csvPath, rows.join('\n') + '\n');
  const findingCount = db.files.reduce((s, f) => s + (f.findings ? f.findings.length : 0), 0);
  console.log(`Exported ${findingCount} findings from ${db.files.length} files to ${csvPath}`);
}

function cmdFixInit() {
  const dbPath = findTracker();
  const db = load(dbPath);
  const fixPath = path.join(path.dirname(dbPath), 'AUDIT_FIXLIST.json');

  const items = [];
  for (const f of db.files) {
    for (const finding of (f.findings || [])) {
      items.push({
        file: f.path,
        line: finding.line,
        category: finding.category,
        severity: finding.severity,
        description: finding.description,
        priority: FIX_PRIORITY[finding.severity] !== undefined ? FIX_PRIORITY[finding.severity] : 2,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }
  }
  items.sort((a, b) => a.priority - b.priority || a.file.localeCompare(b.file));

  const fix = { startedAt: new Date().toISOString(), items };
  fs.writeFileSync(fixPath, JSON.stringify(fix, null, 2));
  console.log(`Created fix list: ${fixPath} (${items.length} items)`);
  cmdFixStatus();
}

function findFixList() {
  const cwdPath = path.join(process.cwd(), 'AUDIT_FIXLIST.json');
  if (fs.existsSync(cwdPath)) return cwdPath;
  try {
    const entries = fs.readdirSync(process.cwd(), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subPath = path.join(process.cwd(), entry.name, 'AUDIT_FIXLIST.json');
        if (fs.existsSync(subPath)) return subPath;
      }
    }
  } catch {}
  return null;
}

function loadFix() {
  const fixPath = findFixList();
  if (!fixPath) {
    console.error('No AUDIT_FIXLIST.json. Run: node audit-tracker.cjs fix-init');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(fixPath, 'utf8'));
}

function saveFix(fix) {
  const fixPath = findFixList() || path.join(process.cwd(), 'AUDIT_FIXLIST.json');
  fs.writeFileSync(fixPath, JSON.stringify(fix, null, 2));
}

function printFixProgress(fix) {
  const total = fix.items.length;
  const done = fix.items.filter(i => i.status === 'done').length;
  const skipped = fix.items.filter(i => i.status === 'skipped').length;
  const pending = fix.items.filter(i => i.status === 'pending').length;
  const pct = total ? ((done / total) * 100).toFixed(1) : '0.0';
  console.log(`Fix Queue: ${done}/${total} done (${pct}%) | ${pending} pending | ${skipped} skipped`);
}

function cmdFixNext() {
  const fix = loadFix();
  const next = fix.items.filter(i => i.status === 'pending').slice(0, 5);
  if (!next.length) { console.log('No pending fixes.'); return; }
  console.log('Next fixes:');
  for (const i of next) {
    const pri = i.priority === 0 ? 'P0-CRIT' : i.priority === 1 ? 'P1-HIGH' : i.priority === 2 ? 'P2-MED' : 'P3-LOW';
    console.log(`  ${i.file}:${i.line} [${pri}] ${i.category}: ${i.description.slice(0, 80)}`);
  }
}

function cmdFixDone(args) {
  const fix = loadFix();
  const [file, line] = args;
  let count = 0;
  for (const i of fix.items) {
    if (i.file === file && (line === undefined || i.line === parseInt(line))) {
      i.status = 'done';
      i.doneAt = new Date().toISOString();
      count++;
    }
  }
  if (!count) { console.error(`No matching items: ${file}:${line || '*'}`); process.exit(1); }
  saveFix(fix);
  console.log(`Marked ${count} fixes done.`);
  printFixProgress(fix);
  cmdFixNext();
}

function cmdFixSkip(args) {
  const fix = loadFix();
  const [file, line, ...reasonParts] = args;
  const reason = reasonParts.join(' ').trim();
  let count = 0;
  for (const i of fix.items) {
    if (i.file === file && (line === undefined || i.line === parseInt(line))) {
      i.status = 'skipped';
      i.skipReason = reason;
      count++;
    }
  }
  if (!count) { console.error(`No matching items: ${file}:${line || '*'}`); process.exit(1); }
  saveFix(fix);
  console.log(`Skipped ${count} fixes.`);
  printFixProgress(fix);
}

function cmdFixStatus() {
  const fix = loadFix();
  printFixProgress(fix);
  const bySev = {};
  for (const i of fix.items) {
    bySev[i.severity] = bySev[i.severity] || { done: 0, pending: 0, skipped: 0 };
    bySev[i.severity][i.status]++;
  }
  for (const [sev, c] of Object.entries(bySev)) {
    console.log(`  ${sev}: ${c.done} done / ${c.pending} pending / ${c.skipped} skipped`);
  }
}

function cmdHelp() {
  console.log(`Usage: node audit-tracker.cjs <command> [args]

Inventory:
  init [path] [--exclude-dir <name>] [--ext .js,.ts]   Build file inventory
  next [count]                                          Print next batch (default 5)

Audit:
  done <path>                                           Mark file done
  add-note <path> "text"                                Add free-text note to file
  add-finding <path> <category> <severity> [line] "desc" Add structured finding
  skip <path> [reason]                                   Skip a file
  back <path>                                            Revert to pending
  overwrite <path>                                       Reopen done file (keep notes/findings)

Status:
  status                                                 Progress summary
  workaholic                                             Print recommended workaholic duration

Export:
  export-csv                                             Export findings to AUDIT_TRACKER.csv

Fix List:
  fix-init                                               Create AUDIT_FIXLIST.json from findings
  fix-next                                               Print next 5 fixes
  fix-done <path> [line]                                  Mark fix done
  fix-skip <path> [line] "reason"                         Skip a fix
  fix-status                                              Fix progress

Categories: security, performance, dead-code, sloppy-code, noisy-logs,
            bad-code, optimization, improvement, qol, polish
Severities: critical, high, medium, low, info`);
}

const [, , op, ...rest] = process.argv;
switch (op) {
  case 'init': cmdInit(rest); break;
  case 'next': cmdNext(rest); break;
  case 'done': cmdDone(rest); break;
  case 'add-note': cmdAddNote(rest); break;
  case 'add-finding': cmdAddFinding(rest); break;
  case 'skip': cmdSkip(rest); break;
  case 'back': cmdBack(rest); break;
  case 'overwrite': cmdOverwrite(rest); break;
  case 'status': cmdStatus(); break;
  case 'workaholic': cmdWorkaholic(); break;
  case 'export-csv': cmdExportCsv(); break;
  case 'fix-init': cmdFixInit(); break;
  case 'fix-next': cmdFixNext(); break;
  case 'fix-done': cmdFixDone(rest); break;
  case 'fix-skip': cmdFixSkip(rest); break;
  case 'fix-status': cmdFixStatus(); break;
  default: cmdHelp();
}
