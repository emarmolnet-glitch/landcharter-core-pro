import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('1. Language selector is completely removed from the TopNav / Header', () => {
  // Extract header content
  const headerStart = source.indexOf('<header');
  assert.notEqual(headerStart, -1, '<header> must exist');
  const headerEnd = source.indexOf('</header>', headerStart);
  assert.notEqual(headerEnd, -1, '</header> must exist');
  const headerContent = source.slice(headerStart, headerEnd);

  // Assert language-selector does not exist inside header
  assert.doesNotMatch(
    headerContent,
    /id=["']language-selector["']/,
    'Language selector must not be located inside <header>'
  );
  assert.doesNotMatch(
    headerContent,
    /changeLanguage\(this\.value\)/,
    'changeLanguage trigger must not be located inside <header>'
  );
});

test('2. Language selector is inserted in Sidebar exactly above the Anchor icon (SeaCharter Core PRO)', () => {
  // Extract sidebar content
  const sidebarStart = source.indexOf('id="app-sidebar"');
  assert.notEqual(sidebarStart, -1, '#app-sidebar must exist');
  const sidebarEnd = source.indexOf('</aside>', sidebarStart);
  assert.notEqual(sidebarEnd, -1, '</aside> must exist');
  const sidebarContent = source.slice(sidebarStart, sidebarEnd);

  // Must contain #sidebar-language-container
  assert.match(
    sidebarContent,
    /id=["']sidebar-language-container["']/,
    'Sidebar must contain #sidebar-language-container'
  );

  // Must contain #language-selector with options
  assert.match(
    sidebarContent,
    /<select[^>]*id=["']language-selector["'][^>]*onchange=["']changeLanguage\(this\.value\)["']/,
    '#language-selector must be inside the sidebar container with onchange="changeLanguage(this.value)"'
  );

  // Assert language selector is placed BEFORE the anchor link (#sidebar-link-seacharter)
  const langSelectorPos = sidebarContent.indexOf('id="sidebar-language-container"');
  const anchorLinkPos = sidebarContent.indexOf('id="sidebar-link-seacharter"');

  assert.notEqual(langSelectorPos, -1, 'Language selector must be found in sidebar');
  assert.notEqual(anchorLinkPos, -1, 'SeaCharter anchor link must be found in sidebar');
  assert.ok(
    langSelectorPos < anchorLinkPos,
    'Language selector must be positioned BEFORE the anchor link (SeaCharter Core PRO)'
  );

  // Assert there is no intervening navigation button between language selector and anchor link
  const intermediateContent = sidebarContent.slice(langSelectorPos, anchorLinkPos);
  assert.doesNotMatch(
    intermediateContent,
    /<a\s+[^>]*class=["'][^"']*sidebar-nav-btn[^"']*["']|<button\s+[^>]*class=["'][^"']*sidebar-nav-btn[^"']*["']/i,
    'Language selector must be positioned immediately above the anchor icon without intervening buttons'
  );
});

test('3. Sidebar language selector adopts sidebar-nav-btn styling and compact responsive design', () => {
  assert.match(
    source,
    /id=["']sidebar-language-container["'][^>]*class=["'][^"']*sidebar-nav-btn[^"']*sidebar-language-item[^"']*["']/,
    '#sidebar-language-container must have sidebar-nav-btn and sidebar-language-item classes'
  );

  // Has SVG globe icon matching sidebar icon dimensions
  assert.match(
    source,
    /<div[^>]*id=["']sidebar-language-container["'][\s\S]*?<svg class=["']sidebar-icon["'][\s\S]*?id=["']sidebar-lang-badge["']/,
    'Sidebar language item must render sidebar-icon SVG and dynamic language badge'
  );

  // Has CSS for sidebar-language-select overlay
  assert.match(
    source,
    /\.sidebar-language-select\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;/,
    'CSS must position sidebar-language-select as full overlay'
  );
});

test('4. Global state and assistant event connectivity are maintained', () => {
  // Selector retains 10 language options
  const options = ['auto', 'es', 'en', 'fr', 'ar', 'pt', 'de', 'it', 'tr', 'zh-CN'];
  for (const opt of options) {
    assert.match(source, new RegExp(`value="${opt}"`));
  }

  // updateSidebarLanguageBadge updates visual badge and container title
  assert.match(source, /function updateSidebarLanguageBadge\(lang\)/);
  assert.match(source, /changeLanguage\([\s\S]*?updateSidebarLanguageBadge/);
  assert.match(source, /initLanguage\([\s\S]*?updateSidebarLanguageBadge/);
  assert.match(source, /syncSelectorValue\([\s\S]*?updateSidebarLanguageBadge/);

  // Dispatches events required by AI assistants (Agente de Proyectos, Cerebro IA, etc.)
  assert.match(source, /window\.dispatchEvent\(new CustomEvent\('seacharter:language-changed'/);
  assert.match(source, /window\.dispatchEvent\(new CustomEvent\('languageChanged'/);
});
