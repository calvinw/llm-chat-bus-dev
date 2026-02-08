import { access, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const busMgmtDocsDir = path.join(repoRoot, 'integrations', 'BusMgmtBenchmarks', 'docs');
const busMgmtEntry = path.join(busMgmtDocsDir, 'company_to_company.html');
const wrapperDocsDir = path.join(repoRoot, 'docs');
const outputDir = path.join(wrapperDocsDir, 'busmgmt');

async function ensurePathExists(targetPath, label) {
  try {
    await access(targetPath);
  } catch {
    throw new Error(`${label} not found at ${targetPath}.`);
  }
}

async function syncBusMgmtAssets() {
  await ensurePathExists(wrapperDocsDir, 'Wrapper docs output');
  await ensurePathExists(busMgmtDocsDir, 'BusMgmt docs output');
  await ensurePathExists(busMgmtEntry, 'BusMgmt company_to_company.html');

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(path.dirname(outputDir), { recursive: true });
  await cp(busMgmtDocsDir, outputDir, { recursive: true });

  console.log(`Synced BusMgmt assets from ${busMgmtDocsDir} -> ${outputDir}`);
}

syncBusMgmtAssets().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
