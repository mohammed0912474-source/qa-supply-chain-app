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

console.log(`Validated ${inlineScripts.length} inline scripts and draft-protection hooks.`);
