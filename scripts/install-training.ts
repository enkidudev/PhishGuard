import { installModules } from '../src/lib/training-modules'
import { installCatalog } from '../src/lib/install-catalog'
import { db } from '../src/lib/db'
import { seedDemo } from './seed'

async function installTraining() {
  if (process.argv.includes('--with-demo')) {
    await db.$transaction(tx => seedDemo(tx, true), { timeout: 15000 });
    console.log('Original demo catalog ready. Existing records were kept.');
  }
  await db.$transaction(installCatalog, { timeout: 20000 });
  await db.$transaction(installModules);
  console.log('Interactive templates and core training lessons are ready.');
}

installTraining().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
