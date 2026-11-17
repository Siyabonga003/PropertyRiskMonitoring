import '../config/env';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from '../database/prisma';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'System Administrator';
  if (!email || !password || password.length < 16) {
    throw new Error('Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 16 characters before running the admin provisioning command.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: Role.ADMIN },
    create: { email, name, passwordHash, role: Role.ADMIN },
  });
  console.log(`Administrator account provisioned for ${user.email}.`);
}

main().catch((error) => { console.error('Administrator provisioning failed:', error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
