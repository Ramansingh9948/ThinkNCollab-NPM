

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function version() {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    console.log(`ThinkNCollab CLI Version: ${pkg.version}`);
    console.log(`ThinkNCollab CLI is Installed at: ${pkgPath}`);
  } catch (error) {
    console.log("Something went wrong while fetching the version:");
    console.log(error);
  }
}
export default version;