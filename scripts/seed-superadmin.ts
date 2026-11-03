// Interactive superadmin seeder: `npm run db:seed:superadmin`.
// Password is only read from a hidden TTY prompt (never argv/env).
import { createInterface } from 'node:readline/promises';

import { hashPassword } from '@/lib/auth/password';
import { deleteUserSessions } from '@/lib/auth/session-store';
import { prisma } from '@/lib/prisma';
import { passwordSchema, usernameSchema, userNameSchema } from '@/lib/user/validation';

const MAX_TRIES = 3;

class Cancelled extends Error {}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

async function confirm(question: string): Promise<boolean> {
  return /^(y|ya|yes)$/i.test((await ask(`${question} (y/N) `)).trim());
}

// Raw-mode read: echo is off before the prompt is written, and restored on every path (Enter, Ctrl+C/D, error, exit).
function askHidden(question: string): Promise<string> {
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    let finished = false;
    const restore = () => {
      if (stdin.isTTY) stdin.setRawMode(false);
    };
    const done = () => {
      if (finished) return false;
      finished = true;
      stdin.off('data', onData);
      stdin.off('error', onError);
      process.off('exit', restore);
      restore();
      stdin.pause();
      process.stdout.write('\n');
      return true;
    };
    const onError = (error: Error) => {
      if (done()) reject(error);
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          if (done()) resolve(value);
          return;
        }
        if (ch === '\u0003' || ch === '\u0004') {
          if (done()) reject(new Cancelled('Dibatalkan.'));
          return;
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };
    process.once('exit', restore);
    stdin.on('error', onError);
    stdin.on('data', onData);
    process.stdout.write(question);
    stdin.resume();
  });
}

async function promptUsername(): Promise<string> {
  for (let i = 0; i < MAX_TRIES; i++) {
    const parsed = usernameSchema.safeParse(await ask('Username: '));
    if (parsed.success) return parsed.data;
    console.error(`  ${parsed.error.issues[0]?.message}`);
  }
  throw new Cancelled('Terlalu banyak percobaan.');
}

async function promptName(): Promise<string> {
  for (let i = 0; i < MAX_TRIES; i++) {
    const raw = (await ask('Nama tampilan [Superadmin]: ')).trim() || 'Superadmin';
    const parsed = userNameSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    console.error(`  ${parsed.error.issues[0]?.message}`);
  }
  throw new Cancelled('Terlalu banyak percobaan.');
}

async function promptPassword(): Promise<string> {
  for (let i = 0; i < MAX_TRIES; i++) {
    const password = await askHidden('Password baru: ');
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      console.error(`  ${parsed.error.issues[0]?.message}`);
      continue;
    }
    if ((await askHidden('Ulangi password: ')) !== password) {
      console.error('  Konfirmasi password tidak sama.');
      continue;
    }
    return password;
  }
  throw new Cancelled('Terlalu banyak percobaan.');
}

async function main(): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Cancelled('Jalankan di terminal interaktif (TTY), mis. `docker run -it ...`.');
  }

  const username = await promptUsername();
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true, name: true, role: true, isActive: true },
  });

  if (!existing) {
    const name = await promptName();
    const password = await promptPassword();
    await prisma.user.create({
      data: { username, name, role: 'SUPERADMIN', isActive: true, passwordHash: await hashPassword(password) },
      select: { id: true },
    });
    console.log(`Superadmin "${username}" dibuat.`);
    return;
  }

  console.log(`Akun "${username}" sudah ada: ${existing.name}, role ${existing.role}, ${existing.isActive ? 'aktif' : 'nonaktif'}.`);
  if (!(await confirm('Reset password akun ini?'))) throw new Cancelled('Tidak ada perubahan.');
  const promote =
    (existing.role !== 'SUPERADMIN' || !existing.isActive) && (await confirm('Jadikan SUPERADMIN dan aktifkan?'));
  const password = await promptPassword();
  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.id },
      data: { passwordHash, ...(promote ? { role: 'SUPERADMIN', isActive: true } : {}) },
      select: { id: true },
    });
    // Superadmins are never PJ (same as lib/user/service.ts updateUser).
    if (promote && existing.role === 'ADMIN') await tx.roomAdmin.deleteMany({ where: { userId: existing.id } });
    await deleteUserSessions(existing.id, tx);
  });
  console.log(`Password "${username}" direset${promote ? ', role SUPERADMIN & aktif' : ''}; semua sesinya dihapus.`);
  if (promote && existing.role === 'ADMIN') {
    console.log('Catatan: penugasan penanggung jawab ruangan akun ini dihapus; cek badge "Belum ada penanggung jawab" di dashboard.');
  }
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error: unknown) => {
    if (error instanceof Cancelled) console.error(error.message);
    else console.error('Gagal:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
