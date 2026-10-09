/* mdview front-end logic */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const treeEl = $('#tree');
  const bodyEl = $('#md-body');
  const searchEl = $('#search');
  const crumbsEl = $('#crumbs');
  const sidebarFoot = $('#sidebar-foot');
  const rootEl = $('#root-path');
  const refreshBtn = $('#refresh');
  const toggleBtn = $('#toggle-tree');
  const layoutEl = document.querySelector('.layout');
  const openDirBtn = $('#open-dir');

  // settings elements
  const settingsBtn = $('#settings-btn');
  const settingsPanel = $('#settings-panel');
  const shortcutsList = $('#shortcuts-list');
  const resetShortcutsBtn = $('#reset-shortcuts');
  const closeSettingsBtn = $('#close-settings');
  const toggleLatexCheckbox = $('#toggle-latex');
  const fontPresetsEl = $('#font-presets');
  const fontSizeInput = $('#font-size-input');
  const fontSizeValue = $('#font-size-value');
  const themeSelect = $('#theme-select');
  const themeDescription = $('#theme-description');
  const customFontInput = $('#custom-font-input');
  const systemFontsDatalist = $('#system-fonts');
  const customFontPreview = $('#custom-font-preview');

  let tree = null;
  let activePath = null;
  let flatList = [];

  // ---------- settings persistence ----------
  const SETTINGS_KEYS = {
    shortcuts: 'mdview.shortcuts.v1',
    sidebar: 'mdview.sidebar.collapsed',
    latex: 'mdview.latex.enabled',
    font: 'mdview.font',
    theme: 'mdview.theme',
    customFont: 'mdview.customFont',
  };

  function loadBool(key, def) {
    try { const v = localStorage.getItem(key); return v == null ? def : v === '1'; } catch (_) { return def; }
  }
  function saveBool(key, v) { try { localStorage.setItem(key, v ? '1' : '0'); } catch (_) {} }

  // ---------- markdown rendering + LaTeX ----------
  const mdLib = window.marked;
  // state: are math expressions emitted as KaTeX spans (true) or escaped to text (false)
  let latexEnabled = loadBool(SETTINGS_KEYS.latex, true);

  // LaTeX strategy: pre-process the markdown source to extract `$...$` and
  // `$$...$$` expressions, replacing them with unique HTML placeholder
  // elements. marked then sees plain text/HTML and doesn't try to be clever
  // with the `$` characters (which was unreliable across marked versions).
  // The placeholder elements are tagged with class `math` and carry the
  // original TeX source as a data-math attribute (safe because DOMPurify
  // doesn't strip data-* attributes by default).

  // Token format: ::MDVMATH-0::, ::MDVMATH-1::, ...
  // We use a global counter so consecutive formulas all get distinct ids.
  const latexStore = []; // [{display: bool, tex: string}]
  function extractLatex(src) {
    const out = [];
    let i = 0;
    let text = '';
    const len = src.length;

    function pushPlain(s) {
        // append s, but watch out for accidental $-from-escapes
        text += s;
      }

    while (i < len) {
      const ch = src[i];

      // Skip code blocks / fenced code / inline code entirely: we don't want
      // to interpret `$...$` inside them.
      if (ch === '`') {
        // fenced ```...```
        if (src.startsWith('```', i)) {
          const end = src.indexOf('```', i + 3);
          if (end >= 0) {
            const block = src.slice(i, end + 3);
            text += block;
            i = end + 3;
            continue;
          }
        }
        // inline `...`
        const eol = src.indexOf('\n', i);
        const lineEnd = eol >= 0 ? eol : len;
        const line = src.slice(i, lineEnd);
        const closeTick = line.indexOf('`', 1);
        if (closeTick > 0) {
          text += line.slice(0, closeTick + 1);
          i += closeTick + 1;
          continue;
        }
        text += ch;
        i += 1;
        continue;
      }

      // $$...$$  (display math, may span lines)
      if (ch === '$' && src[i + 1] === '$') {
        const close = src.indexOf('$$', i + 2);
        if (close > i + 2) {
          const tex = src.slice(i + 2, close).trim();
          const id = latexStore.length;
          latexStore.push({ display: true, tex });
          text += `<span class="math-placeholder" data-math-id="${id}"></span>`;
          i = close + 2;
          continue;
        }
      }

      // $...$ (inline math). Allow anywhere; reject when preceded by digit/
      // letter to avoid "$100 and $200" producing "$100" as math.
      if (ch === '$') {
        const prev = i > 0 ? src[i - 1] : '';
        const prevIsWord = /[A-Za-z0-9]/.test(prev);
        if (!prevIsWord) {
          // find closing $ on the same line
          let j = i + 1;
          while (j < len) {
            if (src[j] === '\n') break;
            if (src[j] === '$') break;
            j += 1;
          }
          if (j < len && src[j] === '$' && j > i + 1) {
            const tex = src.slice(i + 1, j).trim();
            if (tex) {
              const id = latexStore.length;
              latexStore.push({ display: false, tex });
              text += `<span class="math-placeholder" data-math-id="${id}"></span>`;
              i = j + 1;
              continue;
            }
          }
        }
      }

      text += ch;
      i += 1;
    }
    return text;
  }

  function renderLatexInto(root) {
    const nodes = root.querySelectorAll('.math-placeholder[data-math-id]');
    if (!nodes.length) return;
    nodes.forEach((el) => {
      const id = parseInt(el.getAttribute('data-math-id'), 10);
      const item = latexStore[id];
      if (!item) return;
      // LaTeX disabled -> show source as fallback (so user still sees what was there)
      if (!latexEnabled) {
        el.classList.remove('math-placeholder');
        el.classList.add('math', 'math-fallback');
        el.innerHTML = `<code class="math-fallback">${item.display ? '$$' : '$'}${escapeHtml(item.tex)}${item.display ? '$$' : '$'}</code>`;
        return;
      }
      // LaTeX enabled but KaTeX library not yet loaded — try once now,
      // and if still missing schedule a retry once the script finishes loading.
      if (!window.katex) {
        el.classList.remove('math-placeholder');
        el.classList.add('math', 'math-fallback');
        el.innerHTML = `<code class="math-fallback">${escapeHtml(item.tex)}</code>`;
        scheduleLatexRetry();
        return;
      }
      try {
        katex.render(item.tex, el, {
          throwOnError: false,
          displayMode: item.display,
          strict: 'ignore',
          trust: false,
          output: 'html',
        });
        el.classList.remove('math-placeholder');
        el.classList.add('math', item.display ? 'math-display' : 'math-inline');
      } catch (err) {
        el.classList.remove('math-placeholder');
        el.classList.add('math', 'math-fallback');
        el.innerHTML = `<code class="math-fallback">${escapeHtml(item.tex)}</code>`;
      }
    });
  }

  // Retry rendering math placeholders once KaTeX becomes available.
  let _latexRetryTimer = null;
  function scheduleLatexRetry() {
    if (_latexRetryTimer) return;
    _latexRetryTimer = setTimeout(() => {
      _latexRetryTimer = null;
      if (!window.katex) {
        // give it another 200ms — the CDN script may still be loading
        scheduleLatexRetry();
        return;
      }
      // re-run renderLatexInto; placeholders are still in DOM
      renderLatexInto(bodyEl);
    }, 200);
  }

  // Reset the store at the start of each markdown render
  function latexResetStore() { latexStore.length = 0; }

  if (mdLib) {
    mdLib.setOptions({
      gfm: true,
      breaks: false,
      headerIds: true,
      mangle: false,
      highlight(code, lang) {
        try {
          if (lang && window.hljs && window.hljs.getLanguage(lang)) {
            return window.hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
          }
          return window.hljs ? window.hljs.highlightAuto(code).value : code;
      } catch (_) { return code; }
      },
    });
  }

  function renderMath(root) {
    // legacy placeholder; LaTeX is now rendered via renderLatexInto
    renderLatexInto(root);
  }

  function renderMarkdown(src) {
    latexResetStore();
    const pre = extractLatex(src);
    const rawHtml = mdLib ? mdLib.parse(pre) : escapeHtml(pre);
    const safe = window.DOMPurify
      ? DOMPurify.sanitize(rawHtml, {
          ADD_ATTR: ['data-math-id', 'target', 'rel'],
        })
      : rawHtml;
    bodyEl.innerHTML = safe;
    bodyEl.querySelectorAll('pre code').forEach((el) => {
      if (window.hljs && !el.dataset.highlighted) {
        try { hljs.highlightElement(el); } catch (_) {}
      }
    });
    bodyEl.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => {
      if (!h.id) {
        h.id = h.textContent.trim().toLowerCase().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-');
      }
    });
    renderLatexInto(bodyEl);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // ---------- sidebar state ----------
  function applySidebarState(collapsed) {
    layoutEl.classList.toggle('collapsed', !!collapsed);
    toggleBtn.textContent = collapsed ? '⟩⟨' : '⟨⟩';
    toggleBtn.title = collapsed ? '展开侧边栏' : '收起侧边栏';
    saveBool(SETTINGS_KEYS.sidebar, collapsed);
  }

  // ---------- tree rendering ----------
  function fileIcon(ext) {
    const map = {
      '.md': '📘', '.markdown': '📘',
      '.txt': '📄', '.json': '🧾', '.js': '🟨', '.ts': '🔷', '.py': '🐍',
      '.html': '🌐', '.css': '🎨', '.yml': '⚙️', '.yaml': '⚙️',
    };
    return map[ext] || '📄';
  }

  function makeNodeEl(node, depth) {
    const wrap = document.createElement('div');
    const el = document.createElement('div');
    el.className = `node ${node.type}` + (node.md ? ' md' : '');
    el.style.paddingLeft = (8 + depth * 14) + 'px';
    el.dataset.path = node.path;
    el.dataset.type = node.type;
    el.tabIndex = -1;

    const twist = document.createElement('span');
    twist.className = 'twist';
    twist.textContent = node.type === 'dir' ? '▶' : '';
    el.appendChild(twist);

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = node.type === 'dir' ? '📁' : fileIcon(node.ext);
    el.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = node.name;
    el.appendChild(name);

    if (node.type === 'dir') {
      el.addEventListener('click', () => {
        el.classList.toggle('expanded');
        const children = wrap.nextElementSibling;
        if (children) children.style.display = el.classList.contains('expanded') ? 'block' : 'none';
        refreshFlatList();
      });
    } else if (node.type === 'file') {
      el.addEventListener('click', () => openFile(node.path, el));
    }

    wrap.appendChild(el);
    return wrap;
  }

  function renderTree(nodes, depth = 0, parentEl = treeEl) {
    for (const node of nodes || []) {
      if (node.type === 'dir' && node.children) {
        const wrap = makeNodeEl(node, depth);
        parentEl.appendChild(wrap);
        const childrenWrap = document.createElement('div');
        childrenWrap.className = 'children';
        parentEl.appendChild(childrenWrap);
        renderTree(node.children, depth + 1, childrenWrap);
      } else if (node.type === 'file') {
        parentEl.appendChild(makeNodeEl(node, depth));
      }
    }
  }

  function refreshFlatList() {
    flatList = Array.from(treeEl.querySelectorAll('.node')).filter((el) => {
      const t = el.dataset.type;
      if (t === 'file') return true;
      return el.classList.contains('expanded');
    });
  }

  // ---------- file loading ----------
  async function openFile(p, el) {
    activePath = p;
    treeEl.querySelectorAll('.node.active').forEach((n) => n.classList.remove('active'));
    if (el) el.classList.add('active');
    updateCrumbs(p);

    bodyEl.innerHTML = '<div class="loading">读取中…</div>';
    try {
      const r = await fetch(`/api/file?path=${encodeURIComponent(p)}`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: 'request failed' }));
        bodyEl.innerHTML = `<div class="error">⚠ ${escapeHtml(j.error || '读取失败')}</div>`;
        return;
      }
      const data = await r.json();
      if (/\.(md|markdown)$/i.test(p)) {
        renderMarkdown(data.content);
      } else {
        bodyEl.innerHTML = `<pre><code>${escapeHtml(data.content)}</code></pre>`;
      }
    } catch (e) {
      bodyEl.innerHTML = `<div class="error">⚠ ${escapeHtml(String(e))}</div>`;
    }
  }

  function updateCrumbs(p) {
    if (!p) { crumbsEl.innerHTML = ''; return; }
    const parts = p.split(/[\\/]/).filter(Boolean);
    let acc = p.startsWith('/') ? '/' : '';
    const spans = [];
    parts.forEach((part, i) => {
      acc = (acc ? acc + (acc.endsWith('/') ? '' : '/') : '') + part;
      spans.push(`<span class="part" data-path="${escapeHtml(acc)}">${escapeHtml(part)}</span>`);
      if (i < parts.length - 1) spans.push('<span class="sep">/</span>');
    });
    crumbsEl.innerHTML = spans.join('');
  }

  // ---------- search ----------
  function applyFilter(q) {
    q = (q || '').toLowerCase().trim();
    treeEl.querySelectorAll('.node').forEach((el) => {
      const name = el.querySelector('.name').textContent.toLowerCase();
      el.style.display = !q || name.includes(q) ? '' : 'none';
    });
    if (q) {
      treeEl.querySelectorAll('.node.dir').forEach((dirEl) => {
        const wrap = dirEl.nextElementSibling;
        if (!wrap) return;
        const anyVisible = Array.from(wrap.querySelectorAll('.node')).some((n) => n.style.display !== 'none');
        if (anyVisible) {
          dirEl.style.display = '';
          dirEl.classList.add('expanded');
          wrap.style.display = 'block';
        }
      });
    }
  }

  // ---------- tree load ----------
  async function loadTree() {
    treeEl.innerHTML = '<div class="loading">加载中…</div>';
    try {
      const r = await fetch('/api/tree');
      const data = await r.json();
      rootEl.textContent = data.root;
      rootEl.title = data.root;
      tree = data.tree;
      treeEl.innerHTML = '';
      renderTree(tree);
      refreshFlatList();
      Array.from(treeEl.children).forEach((c) => {
        const nodeEl = c.querySelector ? c.querySelector('.node') : null;
        if (nodeEl && nodeEl.dataset.type === 'dir') {
          nodeEl.classList.add('expanded');
          const childsWrap = c.querySelector('.children');
          if (childsWrap) childsWrap.style.display = 'block';
        }
      });
      refreshFlatList();
      const count = treeEl.querySelectorAll('.node.file').length;
      sidebarFoot.textContent = `${count} 文件`;
    } catch (e) {
      treeEl.innerHTML = `<div class="error">⚠ 加载失败: ${escapeHtml(String(e))}</div>`;
    }
  }

  // ---------- shortcut system ----------
  function comboFromEvent(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Mod');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    let key = e.key;
    const code = e.code || '';
    if (code.startsWith('Key')) key = code.slice(3);
    else if (code.startsWith('Digit')) key = code.slice(5);
    else if (code.startsWith('Numpad')) key = code;
    else if (code === 'Space') key = 'Space';
    else if (code === 'ArrowRight' || code === 'ArrowLeft' || code === 'ArrowUp' || code === 'ArrowDown') key = code;
    else if (key === ' ') key = 'Space';
    if (!key) return '';
    if (key.length === 1) key = key.toUpperCase();
    parts.push(key);
    return parts.join('+');
  }

  function formatCombo(combo) {
    if (!combo) return '未设置';
    const isMac = navigator.platform.includes('Mac');
    return combo.split('+').map((p) => {
      if (p === 'Mod') return isMac ? '⌘' : 'Ctrl';
      if (p === 'Ctrl') return 'Ctrl';
      if (p === 'Alt') return isMac ? '⌥' : 'Alt';
      if (p === 'Shift') return isMac ? '⇧' : 'Shift';
      if (p === 'Space') return 'Space';
      if (p === 'ArrowUp') return '↑';
      if (p === 'ArrowDown') return '↓';
      if (p === 'ArrowLeft') return '←';
      if (p === 'ArrowRight') return '→';
      if (p === 'Enter') return '↵';
      if (p === 'Escape') return 'Esc';
      if (p === 'Tab') return 'Tab';
      return p;
    }).join(isMac ? '' : '+');
  }

  const DEFAULT_ACTIONS = [
    { id: 'toggleSidebar', label: '收起/展开侧边栏', combo: 'Mod+\\', handler: () => applySidebarState(!layoutEl.classList.contains('collapsed')) },
    { id: 'focusSearch',   label: '聚焦搜索框',       combo: 'Mod+K', handler: () => { searchEl.focus(); searchEl.select(); } },
    { id: 'moveDown',      label: '下一项',           combo: 'ArrowDown', handler: () => moveSelection(1) },
    { id: 'moveUp',        label: '上一项',           combo: 'ArrowUp',   handler: () => moveSelection(-1) },
    { id: 'openSelected',  label: '打开/展开当前项',  combo: 'Enter',     handler: () => invokeSelected() },
    { id: 'expandDir',     label: '展开目录',         combo: 'ArrowRight', handler: () => expandOrCollapse('expand') },
    { id: 'collapseDir',   label: '折叠目录',         combo: 'ArrowLeft',  handler: () => expandOrCollapse('collapse') },
    { id: 'openSettings',  label: '打开/关闭设置',    combo: 'Mod+,',     handler: () => toggleSettings() },
    { id: 'escapeAction',  label: '退出搜索/关闭设置',combo: 'Escape',    handler: () => {
        if (!settingsPanel.classList.contains('hidden')) { toggleSettings(false); return; }
        if (document.activeElement === searchEl) searchEl.blur();
        else treeEl.focus();
      } },
  ];

  let currentActions = DEFAULT_ACTIONS.map(a => ({ ...a }));

  function loadShortcuts() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEYS.shortcuts);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return;
      currentActions = currentActions.map(a => {
        if (Object.prototype.hasOwnProperty.call(saved, a.id)) {
          return { ...a, combo: saved[a.id] || a.combo };
        }
        return a;
      });
    } catch (_) {}
  }
  function saveShortcuts() {
    const map = {};
    for (const a of currentActions) map[a.id] = a.combo;
    try { localStorage.setItem(SETTINGS_KEYS.shortcuts, JSON.stringify(map)); } catch (_) {}
  }
  function resetShortcuts() {
    currentActions = DEFAULT_ACTIONS.map(a => ({ ...a }));
    try { localStorage.removeItem(SETTINGS_KEYS.shortcuts); } catch (_) {}
    renderShortcutsList();
    flashSettingsTip('已恢复默认快捷键');
  }
  function findConflicts(targetId) {
    const target = currentActions.find(a => a.id === targetId);
    if (!target || !target.combo) return [];
    return currentActions.filter(a => a.id !== targetId && a.combo && a.combo === target.combo).map(a => a.id);
  }

  // ---------- settings panel ----------
  function toggleSettings(force) {
    // next === true  => panel should be OPEN (visible)
    const hidden = settingsPanel.classList.contains('hidden');
    let next;
    if (typeof force === 'boolean') {
      next = force;  // explicit open=true / open=false
    } else {
      next = hidden;  // currently hidden => open it; currently open => close it
    }
    // toggle('hidden', addState)
    //   addState=true  -> add 'hidden' (close)
    //   addState=false -> remove 'hidden' (open)
    settingsPanel.classList.toggle('hidden', !next);
    settingsBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
    if (next) {
      renderShortcutsList();
      const first = shortcutsList.querySelector('.shortcut-input');
      if (first) setTimeout(() => first.focus(), 50);
    }
  }

  let tipTimer = null;
  function flashSettingsTip(msg) {
    const tip = settingsPanel.querySelector('.settings-tip');
    if (!tip) return;
    tip.textContent = msg;
    tip.classList.add('visible');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => tip.classList.remove('visible'), 1800);
  }

  function renderShortcutsList() {
    shortcutsList.innerHTML = '';
    for (const action of currentActions) {
      const row = document.createElement('div');
      row.className = 'shortcut-row';
      row.dataset.id = action.id;

      const label = document.createElement('span');
      label.className = 'shortcut-label';
      label.textContent = action.label;
      row.appendChild(label);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'shortcut-input';
      input.readOnly = true;
      input.value = formatCombo(action.combo);
      input.placeholder = '点击并按下快捷键…';
      input.dataset.actionId = action.id;
      row.appendChild(input);

      const conflicts = findConflicts(action.id);
      if (conflicts.length) {
        const conf = document.createElement('span');
        conf.className = 'shortcut-conflict';
        conf.textContent = `与「${currentActions.find(a => a.id === conflicts[0]).label}」冲突`;
        row.appendChild(conf);
        input.classList.add('conflict');
      }

      shortcutsList.appendChild(row);
    }
  }

  function captureCombo(actionId, e) {
    e.preventDefault();
    e.stopPropagation();
    const action = currentActions.find(a => a.id === actionId);
    if (!action) return;

    if (e.key === 'Escape') {
      action.combo = '';
      renderShortcutsList();
      saveShortcuts();
      flashSettingsTip('已清空快捷键');
      return;
    }
    if (['Control','Shift','Alt','Meta'].includes(e.key)) return;
    const combo = comboFromEvent(e);
    if (!combo) return;

    action.combo = combo;
    const conflicts = findConflicts(actionId);
    if (conflicts.length) {
      flashSettingsTip(`⚠ 与「${currentActions.find(a => a.id === conflicts[0]).label}」冲突`);
    } else {
      flashSettingsTip('已保存');
    }
    saveShortcuts();
    renderShortcutsList();
    const next = shortcutsList.querySelector(`.shortcut-input[data-action-id="${actionId}"]`);
    if (next) next.focus();
  }

  // ---------- moveSelection / invokeSelected / expandOrCollapse ----------
  function moveSelection(delta) {
    if (!flatList.length) return;
    const curIdx = flatList.findIndex(el => el.classList.contains('active'));
    let nextIdx = curIdx < 0 ? (delta > 0 ? 0 : flatList.length - 1) : curIdx + delta;
    nextIdx = Math.max(0, Math.min(flatList.length - 1, nextIdx));
    const target = flatList[nextIdx];
    if (!target) return;
    treeEl.querySelectorAll('.node.active').forEach(n => n.classList.remove('active'));
    target.classList.add('active');
    target.focus();
    target.scrollIntoView({ block: 'nearest' });
  }

  function invokeSelected() {
    if (!flatList.length) return;
    const curIdx = flatList.findIndex(el => el.classList.contains('active'));
    if (curIdx >= 0) flatList[curIdx].click();
    else if (flatList[0]) flatList[0].click();
  }

  function expandOrCollapse(kind) {
    const curIdx = flatList.findIndex(el => el.classList.contains('active'));
    if (curIdx < 0) return;
    const el = flatList[curIdx];
    if (el.dataset.type !== 'dir') return;
    const isExpanded = el.classList.contains('expanded');
    if ((kind === 'expand' && !isExpanded) || (kind === 'collapse' && isExpanded)) {
      el.click();
      refreshFlatList();
    }
  }

  // ---------- global keydown dispatcher ----------
  function dispatchShortcut(e) {
    const ae = document.activeElement;
    const isTyping = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && !ae.classList.contains('shortcut-input');
    if (isTyping) return;
    const combo = comboFromEvent(e);
    if (!combo) return;
    const action = currentActions.find(a => a.combo === combo);
    if (!action) return;
    e.preventDefault();
    action.handler();
  }

  document.addEventListener('keydown', (e) => {
    const ae = document.activeElement;
    if (ae && ae.classList && ae.classList.contains('shortcut-input')) {
      captureCombo(ae.dataset.actionId, e);
      return;
    }
    dispatchShortcut(e);
  });

  // ---------- wiring ----------
  searchEl.addEventListener('input', (e) => applyFilter(e.target.value));
  refreshBtn.addEventListener('click', loadTree);

  toggleBtn.addEventListener('click', () => applySidebarState(!layoutEl.classList.contains('collapsed')));

  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSettings();
  });
  closeSettingsBtn.addEventListener('click', () => toggleSettings(false));

  // close settings when clicking outside
  document.addEventListener('click', (e) => {
    if (settingsPanel.classList.contains('hidden')) return;
    if (settingsPanel.contains(e.target) || settingsBtn.contains(e.target)) return;
    toggleSettings(false);
  });

  resetShortcutsBtn.addEventListener('click', resetShortcuts);

  toggleLatexCheckbox.addEventListener('change', (e) => {
    latexEnabled = !!e.target.checked;
    saveBool(SETTINGS_KEYS.latex, latexEnabled);
    flashSettingsTip(latexEnabled ? 'LaTeX 已启用' : 'LaTeX 已关闭（显示原始公式）');
    // re-render the active file to apply the change
    if (activePath) {
      const activeEl = treeEl.querySelector('.node.active');
      openFile(activePath, activeEl);
    }
  });

  // ---------- font settings ----------
  // CSS variable values for each preset.
  // --mdview-font = UI/topbar fonts (kept as sans for chrome stability)
  // --mdview-md-font-family = body text font for the markdown viewer
  const FONT_PRESETS = {
    sans: {
      label: 'Sans Serif',
      // clean, neutral; works well with Chinese system fonts
      md: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    },
    serif: {
      label: 'Serif',
      // Georgia + 宋体 fallback — great for long-form reading
      md: 'Georgia, "Times New Roman", "Songti SC", "SimSun", serif',
    },
    mono: {
      label: 'Monospace',
      md: '"Cascadia Code", "Source Code Pro", "JetBrains Mono", Menlo, Consolas, monospace',
    },
    mixed: {
      label: 'Sans + Serif (Latin sans / CJK serif)',
      // Use system Chinese serif for CJK characters while keeping Latin sans-serif
      md: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Songti SC", "SimSun", "Source Han Serif SC", serif',
    },
  };

  function loadFontSetting() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEYS.font);
      if (!raw) return { preset: 'sans', size: 15 };
      const obj = JSON.parse(raw);
      return {
        preset: FONT_PRESETS[obj.preset] ? obj.preset : 'sans',
        size: Number.isFinite(obj.size) ? Math.min(20, Math.max(12, obj.size)) : 15,
      };
    } catch (_) { return { preset: 'sans', size: 15 }; }
  }
  function saveFontSetting(preset, size) {
    try { localStorage.setItem(SETTINGS_KEYS.font, JSON.stringify({ preset, size })); } catch (_) {}
  }

  function applyFontSetting(preset, size) {
    const cfg = FONT_PRESETS[preset] || FONT_PRESETS.sans;
    document.documentElement.style.setProperty('--mdview-md-font-family', cfg.md);
    document.documentElement.style.setProperty('--mdview-md-font-size', size + 'px');
    // sync UI controls
    if (fontPresetsEl) {
      fontPresetsEl.querySelectorAll('.font-preset').forEach((el) => {
        const active = el.dataset.font === preset;
        el.setAttribute('aria-checked', active ? 'true' : 'false');
      });
    }
    if (fontSizeInput) fontSizeInput.value = size;
    if (fontSizeValue) fontSizeValue.textContent = size + 'px';
  }

  // wire UI
  if (fontPresetsEl) {
    fontPresetsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.font-preset');
      if (!btn) return;
      const preset = btn.dataset.font;
      const size = parseInt(fontSizeInput.value, 10) || 15;
      applyFontSetting(preset, size);
      saveFontSetting(preset, size);
      flashSettingsTip('字体：' + (FONT_PRESETS[preset].label));
    });
  }
  if (fontSizeInput) {
    fontSizeInput.addEventListener('input', (e) => {
      const size = parseInt(e.target.value, 10);
      fontSizeValue.textContent = size + 'px';
      const active = fontPresetsEl.querySelector('.font-preset[aria-checked="true"]');
      const preset = active ? active.dataset.font : 'sans';
      applyFontSetting(preset, size);
      saveFontSetting(preset, size);
    });
  }

  // ---------- custom font (free-form font-family input) ----------
  function applyCustomFont(family) {
    const root = document.documentElement;
    if (!family) {
      root.style.removeProperty('--mdview-md-font-family');
    } else {
      // Quote the family if it contains spaces, but keep commas for fallbacks.
      // We do NOT validate it; if the family is missing on the system the
      // browser silently falls back to the theme's default.
      const familyCss = family.split(',').map(s => {
        s = s.trim();
        if (!s) return null;
        return /\s/g.test(s) ? `"${s}"` : s;
      }).filter(Boolean).join(', ');
      root.style.setProperty('--mdview-md-font-family', familyCss);
    }
    if (customFontPreview) {
      customFontPreview.style.fontFamily = family || 'inherit';
    }
  }

  function loadCustomFontSetting() {
    try { return localStorage.getItem(SETTINGS_KEYS.customFont) || ''; }
    catch (_) { return ''; }
  }
  function saveCustomFontSetting(v) {
    try { localStorage.setItem(SETTINGS_KEYS.customFont, v); } catch (_) {}
  }

  async function initSystemFonts() {
    if (!systemFontsDatalist) return;
    try {
      const r = await fetch('/api/fonts');
      const data = await r.json();
      const fonts = data.fonts || [];
      // populate <datalist>
      const frag = document.createDocumentFragment();
      for (const f of fonts) {
        const opt = document.createElement('option');
        opt.value = f;
        frag.appendChild(opt);
      }
      systemFontsDatalist.innerHTML = '';
      systemFontsDatalist.appendChild(frag);
      if (customFontInput) customFontInput.placeholder =
        fonts.length
          ? `从本机 ${fonts.length} 个字体中选择或手输…`
          : '手输字体名（未扫到本机字体）';
    } catch (e) {
      if (customFontInput) customFontInput.placeholder = '手输字体名（例如 Segoe UI）';
    }
  }

  if (customFontInput) {
    customFontInput.addEventListener('input', (e) => {
      const v = e.target.value.trim();
      applyCustomFont(v);
      saveCustomFontSetting(v);
    });
  }

  // ---------- directory switching ----------
  const DIR_LS_KEY = 'mdview.directory';
  function rememberDirectory(p) {
    try { localStorage.setItem(DIR_LS_KEY, p); } catch (_) {}
  }
  async function switchDirectory(p) {
    // Inform the backend; backend sets currentRoot
    const r = await fetch('/api/root?path=' + encodeURIComponent(p), { method: 'POST' });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || 'failed to switch directory');
    }
    rememberDirectory(p);
  }

  async function openNativeFolder() {
    openDirBtn.disabled = true;
    openDirBtn.classList.add('working');
    try {
      const r = await fetch('/api/open-dialog', { method: 'POST' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        flashSettingsTip('打开失败：' + (j.error || '未知错误'));
        return;
      }
      const data = await r.json();
      if (data.cancelled) return;
      rememberDirectory(data.path);
      await loadTree();
      // clear active file (it's no longer relevant)
      activePath = null;
      bodyEl.innerHTML = '<div class="placeholder"><h2>📂 ' + escapeHtml(data.path) + '</h2><p>已切换到新目录。从左侧选择文档。</p></div>';
    } catch (e) {
      flashSettingsTip('打开失败：' + e.message);
    } finally {
      openDirBtn.disabled = false;
      openDirBtn.classList.remove('working');
    }
  }

  if (openDirBtn) openDirBtn.addEventListener('click', openNativeFolder);
  if (rootEl) {
    rootEl.addEventListener('click', openNativeFolder);
    rootEl.title = '点击切换目录';
  }

  // ---------- theme management ----------
  let themesCache = []; // [{id, name, description, vars}]

  function applyTheme(theme) {
    if (!theme || !theme.vars) return;
    // write every CSS variable into :root
    const root = document.documentElement;
    for (const [k, v] of Object.entries(theme.vars)) {
      root.style.setProperty(k, String(v));
    }
    if (themeDescription) themeDescription.textContent = theme.description || '';
  }

  async function loadThemeList() {
    try {
      const r = await fetch('/api/themes');
      const data = await r.json();
      themesCache = data.themes || [];
      const defaultId = data.defaultThemeId;

      // populate <select>
      if (themeSelect) {
        themeSelect.innerHTML = '';
        for (const t of themesCache) {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = t.name;
          themeSelect.appendChild(opt);
        }
      }
      // decide active theme: stored choice > default
      const stored = (() => { try { return localStorage.getItem(SETTINGS_KEYS.theme); } catch (_) { return null; } })();
      const activeId = (stored && themesCache.find(t => t.id === stored)) ? stored : defaultId;
      if (themeSelect && activeId) themeSelect.value = activeId;
      if (activeId) {
        const t = await fetchTheme(activeId);
        applyTheme(t);
      }
    } catch (e) {
      console.warn('themes load failed:', e);
      if (themeSelect) themeSelect.innerHTML = '<option value="">主题加载失败</option>';
    }
  }

  async function fetchTheme(id) {
    // prefer cached record to avoid extra round-trip
    const cached = themesCache.find(t => t.id === id);
    if (cached && cached.vars) return cached;
    try {
      const r = await fetch('/api/themes/' + encodeURIComponent(id));
      const j = await r.json();
      // save into array so further selects are consistent
      const i = themesCache.findIndex(t => t.id === id);
      if (i >= 0) themesCache[i] = j; else themesCache.push(j);
      return j;
    } catch (_) { return null; }
  }

  async function initThemes() {
    await loadThemeList();
    if (themeSelect) {
      themeSelect.addEventListener('change', async (e) => {
        const id = e.target.value;
        const t = await fetchTheme(id);
        applyTheme(t);
        try { localStorage.setItem(SETTINGS_KEYS.theme, id); } catch (_) {}
        flashSettingsTip('已切换主题：' + (t.name || id));
      });
    }
  }

// ---------- bootstrap ----------
  loadShortcuts();
  toggleLatexCheckbox.checked = latexEnabled;
  applySidebarState(loadBool(SETTINGS_KEYS.sidebar, false));
  const _font = loadFontSetting();
  applyFontSetting(_font.preset, _font.size);
  const _customFont = loadCustomFontSetting();
  if (_customFont && customFontInput) {
    customFontInput.value = _customFont;
    applyCustomFont(_customFont);
  }

  // Try to restore a previously-chosen directory. If the localStorage value
  // no longer exists (folder deleted, drive unmounted, etc.) we silently
  // fall back to whatever the server started with.
  async function restoreSavedDirectory() {
    let saved;
    try { saved = localStorage.getItem(DIR_LS_KEY); } catch (_) {}
    if (!saved) return;
    const r = await fetch('/api/root?path=' + encodeURIComponent(saved), { method: 'POST' });
    if (r.ok) return; // server accepted -> loadTree will use it
    // bad saved path; clear it so we don't retry every reload
    try { localStorage.removeItem(DIR_LS_KEY); } catch (_) {}
  }
  // we kick this off synchronously before loadTree to ensure /api/tree uses
  // the restored root. (awaiting is fine — no UI flicker because we haven't
  // rendered the tree yet.)
  (async () => {
    await restoreSavedDirectory();
    await loadTree();
  })();
  initSystemFonts();
  initThemes();
})();