import { purgeExpired } from '../src/lib/retention'
import { db } from '../src/lib/db'
purgeExpired(true).then(console.log).finally(() => db.$disconnect())
