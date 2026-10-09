#!/usr/bin/env node
/**
 * mdview - A portable web-based Markdown viewer
 *
 * Usage:
 *   mdview [path] [options]
 *
 * Examples:
 *   mdview                      # open current directory
 *   mdview ./docs               # open ./docs
 *   mdview --port 8080          # custom port
 *   mdview --no-open            # don't auto-open browser
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

// ---------- args parsing ----------
function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    port: null, // auto-pick
    host: '127.0.0.1',
    noOpen: false,
    help: false,
    version: false,
    theme: null, // default theme id; null = let user choose via UI
  };

  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') args.help = true;
    else if (a === '-v' || a === '--version') args.version = true;
    else if (a === '--no-open') args.noOpen = true;
    else if (a === '--port' || a === '-p') args.port = parseInt(argv[++i], 10);
    else if (a === '--host') args.host = argv[++i];
    else if (a === '--theme' || a === '-t') args.theme = argv[++i];
    else if (a.startsWith('-')) {
      console.error(`Unknown option: ${a}`);
      process.exit(2);
    } else {
      positional.push(a);
    }
  }

  if (positional.length > 0) {
    args.root = path.resolve(process.cwd(), positional[0]);
  }

  return args;
}

function printHelp() {
  console.log(`mdview - portable web-based Markdown viewer

Usage:
  mdview [path] [options]

Arguments:
  path                     directory to browse (default: current directory)

Options:
  -p, --port <number>       port to listen on (default: auto-pick free port)
      --host <host>         host to bind (default: 127.0.0.1)
      --no-open             do not auto-open the browser
  -t, --theme <name>     default theme id (default: let user choose)
  -v, --version            show version
  -h, --help               show this help

Keys in viewer:
  ↑/↓ or Tab         navigate file tree
  Enter / Space       open file
  Ctrl+K Search         keyword focus
  Esc                 collapse tree / blur search
`);
}

function printVersion() {
  const pkg = require('../package.json');
  console.log(`mdview v${pkg.version}`);
}

// ---------- helpers ----------
function findFreePort(host, start = 0) {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(start, host, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function pickPort(host, preferred) {
  if (preferred) return preferred;
  // try a few random-ish ports in the ephemeral zone
  const candidates = [4173, 5173, 3000, 8000, 8080, 8888];
  for (const p of candidates) {
    try {
      return await findFreePort(host, p);
    } catch (_) { /* try next */ }
  }
  // fallback: ask OS for a free port
  return await findFreePort(host, 0);
}

function openBrowser(url) {
  const { exec } = require('child_process');
  const cmd =
    process.platform === 'win32' ? `start "" "${url}"` :
    process.platform === 'darwin' ? `open "${url}"` :
    `xdg-open "${url}"`;
  exec(cmd, () => ({}));
}

// ---------- file tree ----------
const HIDDEN_DIRS = new Set(['.git', '.svn', '.hg', 'node_modules', '.idea', '.vscode', '.next', 'dist', '.cache']);
const MAX_TREE_DEPTH = 8;
const MAX_TREE_ENTRIES = 2000; // hard cap to keep responses snappy

function buildTree(rootAbs, depth = 0) {
  if (depth > MAX_TREE_DEPTH) return null;
  let entries;
  try {
    entries = fs.readdirSync(rootAbs, { withFileTypes: true });
  } catch (e) {
    return { error: e.message };
  }

  // sort dirs first, then files; alphabetical within group
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const nodes = [];
  for (const ent of entries) {
    if (ent.name.startsWith('.')) continue; // skip dotfiles (including .git etc.) for tidy output
    if (ent.isDirectory() && HIDDEN_DIRS.has(ent.name)) continue;
    const abs = path.join(rootAbs, ent.name);
    const node = { name: ent.name, path: abs };
    if (ent.isDirectory()) {
      node.type = 'dir';
      if (nodes.length + (nodes.children?.length || 0) > MAX_TREE_ENTRIES) {
        node.truncated = true;
      } else {
        const children = buildTree(abs, depth + 1);
        if (children) node.children = children;
      }
    } else {
      node.type = 'file';
      const ext = path.extname(ent.name).toLowerCase();
      node.ext = ext;
      if (ext === '.md' || ext === '.markdown') node.md = true;
    }
    nodes.push(node);
    if (nodes.length >= MAX_TREE_ENTRIES) break;
  }
  return nodes;
}

// ---------- themes ----------
function loadThemes() {
  const dir = path.join(__dirname, '..', 'themes');
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue;
    const fp = path.join(dir, ent.name);
    try {
      const raw = fs.readFileSync(fp, 'utf8');
      const json = JSON.parse(raw);
      if (!json || typeof json !== 'object' || !json.vars || typeof json.vars !== 'object') continue;
      const id = ent.name.replace(/\.json$/, '');
      out.push({
        id,
        name: json.name || id,
        description: json.description || '',
        vars: json.vars,
      });
    } catch (_) { /* skip malformed theme */ }
  }
  return out;
}

// ---------- system font enumeration ----------
const { execFile } = require('child_process');

/**
 * Scan the OS for installed font families. Returns an array of plain strings.
 * Cached for 60s to avoid hammering the system on every render.
 */
let _fontCache = { ts: 0, fonts: null };
const FONT_CACHE_TTL_MS = 60 * 1000;

function listFontsWindows() {
  return new Promise((resolve) => {
    const ps = [
      'chcp 65001 | Out-Null',
      '$OutputEncoding = [System.Text.Encoding]::UTF8',
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      'Add-Type -AssemblyName System.Drawing',
      '$fonts = (New-Object System.Drawing.Text.InstalledFontCollection).Families',
      '$fonts | ForEach-Object { $_.Name }',
    ].join('; ');
    execFile('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' }, (err, stdout) => {
      if (err) { resolve([]); return; }
      const list = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const seen = new Set();
      const out = [];
      for (const f of list) {
        const k = f.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(f);
      }
      resolve(out);
    });
  });
}

function listFontsMac() {
  return new Promise((resolve) => {
    execFile('system_profiler', ['-xml', 'SPFontsDataType'], { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) { resolve([]); return; }
      // Very rough extraction: family names appear as <string>...</string>
      const matches = stdout.match(/<string>([^<]+)<\/string>/g) || [];
      const set = new Set();
      for (const m of matches) {
        const name = m.replace(/<\/?string>/g, '').trim();
        if (!name) continue;
        set.add(name);
      }
      resolve([...set]);
    });
  });
}

function listFontsLinux() {
  return new Promise((resolve) => {
    execFile('fc-list', [':', 'family'], { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) { resolve([]); return; }
      // fc-list may print comma-separated lists per line, e.g.
      //   "Arial, Helvetica:style=Regular"
      // Extract family names (everything before ":style=" or ":", comma-split).
      const out = new Set();
      stdout.split(/\r?\n/).forEach((line) => {
        const [famPart] = line.split(':');
        if (!famPart) return;
        for (const f of famPart.split(',')) {
          const trimmed = f.trim();
          if (trimmed) out.add(trimmed);
        }
      });
      resolve([...out]);
    });
  });
}

async function listSystemFonts() {
  const now = Date.now();
  if (_fontCache.fonts && now - _fontCache.ts < FONT_CACHE_TTL_MS) {
    return _fontCache.fonts;
  }
  let fonts = [];
  try {
    if (process.platform === 'win32') fonts = await listFontsWindows();
    else if (process.platform === 'darwin') fonts = await listFontsMac();
    else fonts = await listFontsLinux();
  } catch (_) { fonts = []; }
  fonts = fonts.filter(Boolean).sort((a, b) => a.localeCompare(b, 'en'));
  _fontCache = { ts: now, fonts };
  return fonts;
}

// ---------- native folder picker ----------
function openFolderDialogWindows() {
  return new Promise((resolve) => {
    // Use System.Windows.Forms.FolderBrowserDialog via PowerShell.
    // STA is required for dialogs on Windows.
    const ps = [
      'Add-Type -AssemblyName System.Windows.Forms | Out-Null',
      '$f = New-Object System.Windows.Forms.FolderBrowserDialog',
      '$f.Description = "Select the directory mdview should browse"',
      '$f.ShowNewFolderButton = $true',
      '$r = $f.ShowDialog()',
      'if ($r -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output $f.SelectedPath }',
    ].join('; ');
    execFile('powershell', ['-NoProfile', '-STA', '-Command', ps], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) { resolve(null); return; }
      const out = stdout.trim();
      resolve(out || null);
    });
  });
}

function openFolderDialogMac() {
  return new Promise((resolve) => {
    // AppleScript folder picker
    const script = 'POSIX path of (choose folder with prompt "Select directory for mdview")';
    execFile('osascript', ['-e', script], { maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) { resolve(null); return; }
      resolve(stdout.trim() || null);
    });
  });
}

function openFolderDialogLinux() {
  return new Promise((resolve) => {
    // Try zenity, kdialog, then python tkinter as fallback
    execFile('zenity', ['--file-selection', '--directory', '--title=Select directory for mdview'], { maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (!err) { resolve(stdout.trim() || null); return; }
      execFile('kdialog', ['--getexistingdirectory', '..'], { maxBuffer: 1024 * 1024 }, (err2, stdout2) => {
        if (!err2) { resolve(stdout2.trim() || null); return; }
        // final fallback: small Python tkinter dialog
        const py = `
          import tkinter as tk
          from tkinter import filedialog
          r = tk.Tk(); r.withdraw()
          print(filedialog.askdirectory(title="Select directory for mdview"))
        `;
        execFile('python', ['-c', py], { maxBuffer: 1024 * 1024 }, (err3, stdout3) => {
          if (err3) { resolve(null); return; }
          resolve(stdout3.trim() || null);
        });
      });
    });
  });
}

async function openNativeFolderDialog() {
  if (process.platform === 'win32') return openFolderDialogWindows();
  if (process.platform === 'darwin') return openFolderDialogMac();
  return openFolderDialogLinux();
}

// ---------- main ----------
async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }
  if (args.version) { printVersion(); process.exit(0); }

  if (!fs.existsSync(args.root)) {
    console.error(`Error: path does not exist: ${args.root}`);
    process.exit(1);
  }
  const stat = fs.statSync(args.root);
  if (!stat.isDirectory()) {
    console.error(`Error: not a directory: ${args.root}`);
    process.exit(1);
  }

  const app = express();

  // static assets
  app.use('/static', express.static(path.join(__dirname, '..', 'public')));

  // themes
  const themes = loadThemes();
  const defaultThemeId = (args.theme && themes.find(t => t.id === args.theme))
    ? args.theme
    : (themes[0] ? themes[0].id : null);

  // API: list themes
  app.get('/api/themes', (req, res) => {
    res.json({
      themes: themes.map(t => ({ id: t.id, name: t.name, description: t.description })),
      defaultThemeId,
    });
  });
  // API: get a single theme's CSS vars
  app.get('/api/themes/:id', (req, res) => {
    const t = themes.find(x => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'theme not found' });
    res.json({ id: t.id, name: t.name, description: t.description, vars: t.vars });
  });

  // API: list system-installed font families
  app.get('/api/fonts', async (req, res) => {
    try {
      const fonts = await listSystemFonts();
      res.json({
        platform: process.platform,
        fonts,
        count: fonts.length,
        cached: !!_fontCache.fonts,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // root path = mounted directory (encoded to avoid weird path issues)
  const rootEncoded = encodeURIComponent(args.root);
  // `currentRoot` is mutable so users can switch directories at runtime
  // via the UI. It always stays within `args.root` OR an explicit user choice.
  let currentRoot = args.root;

  // API: get current root
  app.get('/api/root', (req, res) => {
    res.json({ root: currentRoot, initialRoot: args.root });
  });

  // API: switch root directory. Accepts `path` query param.
  // We allow any directory the OS lets the process read (the user picked it
  // through a native dialog), but refuse any path outside args.root only
  // when --root is locked. Here we always trust the user-provided path.
  app.post('/api/root', (req, res) => {
    const newRoot = req.query.path || (req.body && req.body.path);
    if (typeof newRoot !== 'string' || !newRoot) {
      return res.status(400).json({ error: 'path required' });
    }
    const abs = path.resolve(newRoot);
    let st;
    try { st = fs.statSync(abs); }
    catch (e) { return res.status(404).json({ error: e.message }); }
    if (!st.isDirectory()) {
      return res.status(400).json({ error: 'not a directory' });
    }
    currentRoot = abs;
    res.json({ root: abs });
  });

  // API: open the native folder picker. Returns { cancelled: true } if
  // the user cancelled, or { path } if they selected one.
  app.post('/api/open-dialog', async (req, res) => {
    try {
      const picked = await openNativeFolderDialog();
      if (!picked) return res.json({ cancelled: true });
      // also switch immediately so the UI doesn't need a second round-trip
      const abs = path.resolve(picked);
      try {
        const st = fs.statSync(abs);
        if (!st.isDirectory()) return res.status(400).json({ error: 'not a directory' });
      } catch (e) { return res.status(404).json({ error: e.message }); }
      currentRoot = abs;
      res.json({ path: abs });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // API: list tree (uses currentRoot)
  app.get('/api/tree', (req, res) => {
    const tree = buildTree(currentRoot);
    res.json({ root: currentRoot, tree });
  });

  // API: read file
  app.get('/api/file', (req, res) => {
    const requested = req.query.path;
    if (typeof requested !== 'string') return res.status(400).json({ error: 'path required' });

    const abs = path.resolve(requested);
    // path traversal protection — must be inside the currently-mounted root
    const rel = path.relative(currentRoot, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return res.status(403).json({ error: 'access denied: path outside root' });
    }
    try {
      const st = fs.statSync(abs);
      if (!st.isFile()) return res.status(400).json({ error: 'not a file' });
      if (st.size > 5 * 1024 * 1024) return res.status(413).json({ error: 'file too large (>5MB)' });
      const content = fs.readFileSync(abs, 'utf8');
      res.json({ path: abs, size: st.size, mtime: st.mtimeMs, content });
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  });

  // index page
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  const port = await pickPort(args.host, args.port);
  const server = app.listen(port, args.host, () => {
    const url = `http://${args.host === '0.0.0.0' ? 'localhost' : args.host}:${port}/`;
    console.log('');
    console.log(`  mdview is running`);
    console.log(`  ────────────────────────────────────────────`);
    console.log(`  Root : ${args.root}`);
    console.log(`  URL  : ${url}`);
    console.log(`  ────────────────────────────────────────────`);
    console.log(`  Press Ctrl+C to stop`);
    console.log('');
    if (!args.noOpen) openBrowser(url);
  });

  // graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});