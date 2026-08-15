const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const sourcePath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(sourcePath, 'utf8');
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);

if (inlineScripts.length < 3) {
  throw new Error('Expected the original application to contain its inline scripts.');
}

inlineScripts.forEach((script, index) => {
  try {
    new Function(script);
  } catch (error) {
    throw new Error(`Inline script ${index + 1} has a syntax error: ${error.message}`);
  }
});

const requiredDraftTokens = [
  'function saveCurrentDraft(sectionId)',
  'function scheduleDraftSave(sectionId)',
  "data-action=\"discard-draft\"",
  'clearFormDraft(sectionId)',
];

requiredDraftTokens.forEach((token) => {
  if (!html.includes(token)) throw new Error(`Missing draft protection token: ${token}`);
});

const requiredUpgradeTokens = [
  'placeholder="YYYY-MM-DD"',
  'readyForDispatch',
  "label:{ar:'كمية NC', en:'NC Quantity'}",
  'function uploadProfilePicture(file)',
  'async function notifyReportSaved(filename)',
  'Quality & Supply Chain Operations',
  'function recordMatchesSectionFilters(sectionId, record)',
  'data-filter-key="blNumber"',
  'data-filter-key="truckNo"',
  'data-filter-key="product"',
  'data-filter-key="month"',
  'export-filtered-xlsx',
  'async function shareFilteredPDF(sectionId)',
  'operations-shell',
  'home-shell',
];

requiredUpgradeTokens.forEach((token) => {
  if (!html.includes(token)) throw new Error(`Missing requested upgrade token: ${token}`);
});

if (html.includes("key:'batchNumber'")) throw new Error('Shipment batch number field should not remain in the schema.');
if (/type=["']date["']/.test(html)) throw new Error('Date fields must support manual entry rather than browser date-only controls.');

const helperStart = html.indexOf('function filterDefaults(sectionId)');
const helperEnd = html.indexOf('/* ---- Professional operations workspace / List view ---- */', helperStart);
if (helperStart < 0 || helperEnd < 0) throw new Error('Unable to locate the section filtering helpers.');

const filterContext = {
  state: { sectionFilters: {} },
  asArray: (value) => Array.isArray(value) ? value : [],
  getRecords: () => [],
  LANG: 'ar',
  t: (value) => value,
};
vm.createContext(filterContext);
vm.runInContext(html.slice(helperStart, helperEnd), filterContext);

filterContext.setSectionFilter('containers', 'blNumber', 'BL-2026');
assert.equal(filterContext.recordMatchesSectionFilters('containers', { blNumber: 'BL-2026-0142', date: '2026-08-13' }), true);
assert.equal(filterContext.recordMatchesSectionFilters('containers', { blNumber: 'BL-2025-0142', date: '2026-08-13' }), false);

filterContext.clearSectionFilters('trucks');
filterContext.setSectionFilter('trucks', 'truckNo', '2841');
filterContext.setSectionFilter('trucks', 'product', 'سكر');
assert.equal(filterContext.recordMatchesSectionFilters('trucks', { date: '2026-08-07', truckNo: '2841 د ب ع', products: [{ product: 'سكر أبيض' }] }), true);
assert.equal(filterContext.recordMatchesSectionFilters('trucks', { date: '2026-08-07', truckNo: '2841 د ب ع', products: [{ product: 'دقيق' }] }), false);

filterContext.clearSectionFilters('rebacking');
filterContext.setSectionFilter('rebacking', 'month', '2026-08');
filterContext.setSectionFilter('rebacking', 'product', 'سكر');
assert.equal(filterContext.recordMatchesSectionFilters('rebacking', { date: '2026-08-12', product: 'سكر معاد معالجته' }), true);
assert.equal(filterContext.recordMatchesSectionFilters('rebacking', { date: '2026-07-12', product: 'سكر معاد معالجته' }), false);
assert.equal(filterContext.hasActiveSectionFilters('rebacking'), true);

console.log(`Validated ${inlineScripts.length} inline scripts, requested upgrades, and live section-filter logic.`);
