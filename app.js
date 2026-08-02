const viewer = document.querySelector('.viewer');
const contentPane = document.querySelector('.content-pane');
const sourceView = document.getElementById('source-view');
const wikiView = document.getElementById('wiki-view');
const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
const mobileNavClose = document.querySelector('.mobile-nav-close');
const mobilePaneToggle = document.querySelector('.mobile-pane-toggle');
const blankPage = 'blank.html';
const overviewPage = 'overview-content.html';
let pendingExplicitPanel = null;
let applyingState = false;
let mobilePane = 'wiki';

function currentMode() {
  return viewer.classList.contains('topic-mode') ? 'topic' : 'source';
}

function setMode(mode, update = true) {
  viewer.classList.toggle('topic-mode', mode === 'topic');
  if (update) updateHash();
}

function setMobilePane(pane) {
  mobilePane = pane === 'source' ? 'source' : 'wiki';
  viewer.classList.toggle('mobile-active-source', mobilePane === 'source');
  viewer.classList.toggle('mobile-active-wiki', mobilePane !== 'source');
  if (mobilePaneToggle) {
    mobilePaneToggle.textContent = mobilePane === 'source' ? 'Content' : 'Source';
  }
}

function closeMobileNav() {
  viewer.classList.remove('mobile-nav-open');
}

function setWikiPanel(panel, explicit, update = true) {
  if (!panel) return;
  if (explicit) pendingExplicitPanel = panel;
  wikiView.src = panel;
  if (update) updateHash();
}

function setSourcePage(source, update = true) {
  if (!source) return;
  sourceView.src = source;
  if (update) updateHash();
}

function viewerPathFromUrl(value) {
  try {
    const target = new URL(value, window.location.href);
    const base = new URL('.', window.location.href);
    if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) {
      return '';
    }
    const path = target.pathname.slice(base.pathname.length) || blankPage;
    return decodeURIComponent(path) + target.search + target.hash;
  } catch (_error) {
    return '';
  }
}

function framePath(frame) {
  try {
    return viewerPathFromUrl(frame.contentWindow.location.href) || frame.getAttribute('src') || blankPage;
  } catch (_error) {
    return frame.getAttribute('src') || blankPage;
  }
}

function parseState() {
  const params = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash);
  return {
    mode: params.get('mode') === 'topic' ? 'topic' : 'source',
    source: params.get('source') || blankPage,
    wiki: params.get('wiki') || overviewPage,
  };
}

function updateHash() {
  if (applyingState) return;
  const params = new URLSearchParams();
  const mode = currentMode();
  const source = framePath(sourceView);
  const wiki = framePath(wikiView);
  if (mode === 'topic') params.set('mode', 'topic');
  if (source && source !== blankPage) params.set('source', source);
  if (wiki && wiki !== overviewPage) params.set('wiki', wiki);
  const nextHash = params.toString();
  const nextUrl = nextHash ? `${window.location.pathname}${window.location.search}#${nextHash}` : `${window.location.pathname}${window.location.search}`;
  if (window.location.hash.slice(1) !== nextHash) {
    history.replaceState(null, '', nextUrl);
  }
}

function applyStateFromHash() {
  const state = parseState();
  applyingState = true;
  pendingExplicitPanel = null;
  setMode(state.mode, false);
  sourceView.src = state.source;
  wikiView.src = state.wiki;
  openDetailsForSource(state.source);
  setMobilePane(state.mode === 'source' && state.source !== blankPage ? 'source' : 'wiki');
  applyingState = false;
}

function openDetailsForSource(source) {
  if (!source || source === blankPage) return;
  const sourcePath = source.split('#')[0];
  document.querySelectorAll('.tree-pane a[data-panel]').forEach((link) => {
    if (link.getAttribute('href') !== sourcePath) return;
    for (let node = link.parentElement; node; node = node.parentElement) {
      if (node.tagName === 'DETAILS') node.open = true;
    }
  });
}

document.querySelectorAll('[data-panel]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    setMode('source', false);
    setSourcePage(link.getAttribute('href'), false);
    setWikiPanel(link.dataset.panel, true, false);
    setMobilePane(link.getAttribute('href') ? 'source' : 'wiki');
    closeMobileNav();
    updateHash();
  });
});
document.querySelectorAll('.topic-link').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    setMode('topic', false);
    pendingExplicitPanel = null;
    setWikiPanel(link.getAttribute('href'), false, false);
    setMobilePane('wiki');
    closeMobileNav();
    updateHash();
  });
});
sourceView.addEventListener('load', updateHash);
wikiView.addEventListener('load', updateHash);
window.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'source-link') {
    setMode('source', false);
    setSourcePage(event.data.source, false);
    setWikiPanel(event.data.panel, true, false);
    setMobilePane(event.data.source ? 'source' : 'wiki');
    closeMobileNav();
    updateHash();
  } else if (event.data.type === 'source-page') {
    setMode('source', false);
    if (pendingExplicitPanel && event.data.panel !== pendingExplicitPanel) {
      pendingExplicitPanel = null;
      return;
    }
    pendingExplicitPanel = null;
    setWikiPanel(event.data.panel, false, false);
    updateHash();
  } else if (event.data.type === 'frame-location') {
    updateHash();
  }
});
window.addEventListener('hashchange', applyStateFromHash);
applyStateFromHash();

const symbolSearch = document.getElementById('symbol-search');
const symbolSearchStatus = document.getElementById('symbol-search-status');
const symbolSearchResults = document.getElementById('symbol-search-results');
let symbolSearchIndex = [];
try {
  const searchIndexNode = document.getElementById('symbol-search-index');
  symbolSearchIndex = JSON.parse(searchIndexNode ? searchIndexNode.textContent : '[]');
} catch (_error) {
  symbolSearchIndex = [];
}

function searchText(entry) {
  return `${entry.name} ${entry.kind} ${entry.path}`.toLowerCase();
}

function renderSymbolSearchResults(query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  symbolSearchResults.replaceChildren();
  if (!terms.length) {
    symbolSearchStatus.textContent = 'Type to search symbols.';
    return;
  }
  const matches = symbolSearchIndex
    .filter((entry) => terms.every((term) => searchText(entry).includes(term)))
    .sort((left, right) => {
      const leftExact = left.name.toLowerCase() === terms[0] ? 0 : 1;
      const rightExact = right.name.toLowerCase() === terms[0] ? 0 : 1;
      const leftKind = left.kind === 'file' ? 0 : 1;
      const rightKind = right.kind === 'file' ? 0 : 1;
      return leftExact - rightExact || leftKind - rightKind || left.name.localeCompare(right.name) || left.path.localeCompare(right.path);
    })
    .slice(0, 50);
  if (!matches.length) {
    symbolSearchStatus.textContent = 'No matching symbols.';
    return;
  }
  symbolSearchStatus.textContent = `${matches.length} result${matches.length === 1 ? '' : 's'}`;
  for (const entry of matches) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    const meta = document.createElement('span');
    link.href = entry.source;
    link.target = 'source-view';
    link.textContent = entry.name;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      setMode('source', false);
      setSourcePage(entry.source, false);
      setWikiPanel(entry.panel, true, false);
      setMobilePane('source');
      closeMobileNav();
      updateHash();
    });
    meta.textContent = entry.line ? `${entry.kind} · ${entry.path}:${entry.line}` : `${entry.kind} · ${entry.path}`;
    item.append(link, meta);
    symbolSearchResults.append(item);
  }
}

if (symbolSearch && symbolSearchStatus && symbolSearchResults) {
  symbolSearch.addEventListener('input', () => renderSymbolSearchResults(symbolSearch.value));
}

if (mobileNavToggle) {
  mobileNavToggle.addEventListener('click', (event) => {
    event.preventDefault();
    viewer.classList.add('mobile-nav-open');
  });
}
if (mobileNavClose) {
  mobileNavClose.addEventListener('click', (event) => {
    event.preventDefault();
    closeMobileNav();
  });
}
if (mobilePaneToggle) {
  mobilePaneToggle.addEventListener('click', (event) => {
    event.preventDefault();
    setMobilePane(mobilePane === 'source' ? 'wiki' : 'source');
  });
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

document.querySelectorAll('[data-resize]').forEach((splitter) => {
  splitter.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    splitter.setPointerCapture(event.pointerId);
    const mode = splitter.dataset.resize;
    const viewerRect = viewer.getBoundingClientRect();
    const contentRect = contentPane.getBoundingClientRect();
    const onMove = (moveEvent) => {
      if (mode === 'tree') {
        const width = clamp(moveEvent.clientX - viewerRect.left, 180, viewerRect.width - 360);
        viewer.style.setProperty('--tree-width', `${width}px`);
      } else if (mode === 'source' && !viewer.classList.contains('topic-mode')) {
        const height = clamp(moveEvent.clientY - contentRect.top, 120, contentRect.height - 120);
        contentPane.style.setProperty('--source-height', `${height}px`);
      }
    };
    const onUp = () => {
      splitter.removeEventListener('pointermove', onMove);
      splitter.removeEventListener('pointerup', onUp);
      splitter.removeEventListener('pointercancel', onUp);
    };
    splitter.addEventListener('pointermove', onMove);
    splitter.addEventListener('pointerup', onUp);
    splitter.addEventListener('pointercancel', onUp);
  });
});
