const fs = require('node:fs');
const path = require('node:path');

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
];

requiredUpgradeTokens.forEach((token) => {
  if (!html.includes(token)) throw new Error(`Missing requested upgrade token: ${token}`);
});

if (html.includes("key:'batchNumber'")) throw new Error('Shipment batch number field should not remain in the schema.');
if (/type=["']date["']/.test(html)) throw new Error('Date fields must support manual entry rather than browser date-only controls.');

console.log(`Validated ${inlineScripts.length} inline scripts, draft protection, and requested operational upgrades.`);
