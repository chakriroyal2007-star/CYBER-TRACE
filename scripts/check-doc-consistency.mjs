#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

console.log('🔍 Checking Documentation Consistency...');

let errors = 0;

// 1. Verify TEST_RESULTS.md exists
const testResultsPath = join(ROOT, 'docs', 'TEST_RESULTS.md');
if (!existsSync(testResultsPath)) {
  console.error('❌ docs/TEST_RESULTS.md not found.');
  process.exit(1);
}
const testResultsContent = readFileSync(testResultsPath, 'utf8');
const testMatch = testResultsContent.match(/Total Tests:\*\*\s+(\d+)/);
if (!testMatch) {
  console.error('❌ Could not parse total test count from docs/TEST_RESULTS.md');
  process.exit(1);
}
const expectedTestCount = parseInt(testMatch[1], 10);
console.log(`✔ Found ${expectedTestCount} passing tests in docs/TEST_RESULTS.md`);

// 2. Check README.md references the exact test count
const readmePath = join(ROOT, 'README.md');
const readmeContent = readFileSync(readmePath, 'utf8');

const readmeBadgeMatch = readmeContent.match(/Tests-(\d+)%2F(\d+)%20Passing/);
if (!readmeBadgeMatch) {
  console.error('❌ README.md does not contain the Tests badge matching regex `Tests-(\\d+)%2F(\\d+)%20Passing`');
  errors++;
} else {
  const badgeCount = parseInt(readmeBadgeMatch[1], 10);
  if (badgeCount !== expectedTestCount) {
    console.error(`❌ README badge test count (${badgeCount}) does not match docs/TEST_RESULTS.md (${expectedTestCount})`);
    errors++;
  } else {
    console.log(`✔ README badge test count matches (${badgeCount}/${badgeCount})`);
  }
}

// 3. Verify files in README directory tree exist on disk
const treeMatch = readmeContent.match(/```[\s\S]*?CYBER-TRACE\/([\s\S]*?)```/);
if (treeMatch) {
  const treeLines = treeMatch[1].split('\n');
  const pathStack = [];

  for (const rawLine of treeLines) {
    if (!rawLine.trim()) continue;
    // Strip comments
    const lineWithoutComment = rawLine.split('#')[0];
    // Find the item name after tree markers (├──, └──, │, spaces)
    const match = lineWithoutComment.match(/^[│\s├──└──]+\s*([a-zA-Z0-9_\-\.]+[\/]?)/);
    if (!match) continue;

    const itemName = match[1].trim();
    if (!itemName) continue;

    // Calculate depth based on leading indentation before the tree glyph
    const indent = rawLine.search(/[├──└──]/);
    const depth = indent > 0 ? Math.floor(indent / 4) : 0;

    // Adjust path stack to current depth
    pathStack.length = depth;

    if (itemName.endsWith('/')) {
      pathStack.push(itemName.slice(0, -1));
    } else {
      const fullRelativePath = [...pathStack, itemName].join('/');
      const diskPath = join(ROOT, fullRelativePath);
      if (!existsSync(diskPath)) {
        console.error(`❌ File listed in README tree does not exist on disk: "${fullRelativePath}"`);
        errors++;
      } else {
        // Verified
      }
    }
  }
}

if (errors > 0) {
  console.error(`\n❌ Documentation consistency check failed with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log('\n✅ Documentation consistency check passed: Zero drift between docs and code.');
  process.exit(0);
}
