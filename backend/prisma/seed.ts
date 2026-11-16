import { seedDatabase } from '../src/database/seed';

seedDatabase()
  .catch((e) => {
    console.error('[Seed] Error seeding database:', e);
    process.exit(1);
  });
