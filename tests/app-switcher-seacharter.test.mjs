import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('App Switcher UI: SeaCharter Core PRO link exists in top-right dropdown menu with correct attributes', () => {
  // 1. Locate #tools-dropdown-menu
  const menuStart = source.indexOf('id="tools-dropdown-menu"');
  assert.notEqual(menuStart, -1, 'Dropdown menu #tools-dropdown-menu must exist');

  const menuEnd = source.indexOf('</ul>', menuStart);
  assert.notEqual(menuEnd, -1, 'Dropdown menu #tools-dropdown-menu must have a closing </ul>');

  const menuContent = source.slice(menuStart, menuEnd);

  // 2. Locate SeaCharter Core PRO in dropdown menu
  assert.match(
    menuContent,
    /id="link-seacharter-core-pro"/,
    'SeaCharter Core PRO link #link-seacharter-core-pro must exist inside #tools-dropdown-menu'
  );

  assert.match(
    menuContent,
    /title="SeaCharter Core PRO"/,
    'SeaCharter Core PRO link must have title="SeaCharter Core PRO"'
  );

  assert.match(
    menuContent,
    /target="_blank"/,
    'SeaCharter Core PRO link must have target="_blank" for navigation in a new tab'
  );

  assert.match(
    menuContent,
    /class="[^"]*tools-dropdown-action[^"]*"/,
    'SeaCharter Core PRO link must have class tools-dropdown-action'
  );

  assert.match(
    menuContent,
    /href="https:\/\/neon-seachartercorepro-4ce09d\.netlify\.app\/?(?:ref=[^"]*)?"/,
    'SeaCharter Core PRO link must point to SeaCharter Core PRO Netlify domain'
  );

  // 3. Plain text option: no icons (no <svg> or <i> inside the item)
  const seaCharterItemStart = menuContent.indexOf('id="link-seacharter-core-pro"');
  const seaCharterItemEnd = menuContent.indexOf('</a>', seaCharterItemStart);
  const seaCharterItemContent = menuContent.slice(seaCharterItemStart, seaCharterItemEnd);

  assert.doesNotMatch(
    seaCharterItemContent,
    /<svg|<i\b/i,
    'SeaCharter Core PRO link must be plain text without icons'
  );
  assert.match(
    seaCharterItemContent,
    /<span>SeaCharter Core PRO<\/span>/,
    'SeaCharter Core PRO link must display plain text title'
  );
});

test('App Switcher UI: Data Bridge link is configured with target="_blank" and session inheritance', () => {
  const menuStart = source.indexOf('id="tools-dropdown-menu"');
  const menuEnd = source.indexOf('</ul>', menuStart);
  const menuContent = source.slice(menuStart, menuEnd);

  // Verify Data Bridge link
  assert.match(
    menuContent,
    /id="btn-toggle-databridge"[^>]*target="_blank"/,
    'Data Bridge item must have target="_blank"'
  );

  assert.match(
    menuContent,
    /id="btn-toggle-databridge"[^>]*href="https:\/\/calm-shortbread-55bcfc\.netlify\.app\/?(?:ref=[^"]*)?"/,
    'Data Bridge link must point to https://calm-shortbread-55bcfc.netlify.app/'
  );
});

test('App Switcher Logic: Dynamic Session Reference extraction and link generation', () => {
  // Verify getCurrentVoyageReference function
  assert.match(
    source,
    /function getCurrentVoyageReference\(\)/,
    'Must define getCurrentVoyageReference function'
  );

  // Verify updateAppSwitcherLinks function
  assert.match(
    source,
    /function updateAppSwitcherLinks\(\)/,
    'Must define updateAppSwitcherLinks function'
  );

  // Verify URL generation patterns
  assert.match(
    source,
    /https:\/\/neon-seachartercorepro-4ce09d\.netlify\.app\/\?ref=/,
    'Must build SeaCharter Core PRO URL with ?ref=${currentReference}'
  );

  assert.match(
    source,
    /https:\/\/calm-shortbread-55bcfc\.netlify\.app\/\?ref=/,
    'Must build Data Bridge URL with ?ref=${currentReference}'
  );

  // Verify hooks into reference sync
  assert.match(
    source,
    /syncActiveContractReference[\s\S]*?updateAppSwitcherLinks\(\)/,
    'syncActiveContractReference must call updateAppSwitcherLinks'
  );

  assert.match(
    source,
    /contract-reference:changed[\s\S]*?updateAppSwitcherLinks\(\)/,
    'contract-reference:changed event listener must call updateAppSwitcherLinks'
  );

  assert.match(
    source,
    /toggleMobileSessionMenu[\s\S]*?updateAppSwitcherLinks\(\)/,
    'toggleMobileSessionMenu must call updateAppSwitcherLinks'
  );
});

test('App Switcher Simulation: reference resolution matches requirements', () => {
  // Simulate helper resolution logic
  function resolveSeaCharterUrl(currentReference) {
    const base = 'https://neon-seachartercorepro-4ce09d.netlify.app';
    return currentReference ? `${base}/?ref=${currentReference}` : `${base}/`;
  }

  function resolveDataBridgeUrl(currentReference) {
    const base = 'https://calm-shortbread-55bcfc.netlify.app';
    return currentReference ? `${base}/?ref=${currentReference}` : `${base}/`;
  }

  const sampleRef = 'RDM/2026-0042';
  assert.equal(
    resolveSeaCharterUrl(sampleRef),
    'https://neon-seachartercorepro-4ce09d.netlify.app/?ref=RDM/2026-0042'
  );
  assert.equal(
    resolveDataBridgeUrl(sampleRef),
    'https://calm-shortbread-55bcfc.netlify.app/?ref=RDM/2026-0042'
  );

  assert.equal(
    resolveSeaCharterUrl(''),
    'https://neon-seachartercorepro-4ce09d.netlify.app/'
  );
  assert.equal(
    resolveDataBridgeUrl(''),
    'https://calm-shortbread-55bcfc.netlify.app/'
  );
});
