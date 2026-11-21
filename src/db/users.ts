import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateGoogleUser(uid: string, email: string, displayName?: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const name = (displayName || cleanEmail.split('@')[0] || 'Security Operator').trim();
    const result = await db
      .insert(users)
      .values({
        uid,
        email: cleanEmail,
        displayName: name,
        authProvider: 'google',
        lastLoginAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: cleanEmail,
          displayName: name,
          lastLoginAt: new Date(),
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database error in getOrCreateGoogleUser:', error);
    throw new Error('Unable to synchronize Google account with database.', { cause: error });
  }
}

export async function registerEmailUser(email: string, password: string, displayName?: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (existing.length > 0) {
      return { ok: false as const, error: 'An account with this email already exists. Please sign in.' };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const uid = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const name = (displayName || cleanEmail.split('@')[0] || 'Operator').trim();

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email: cleanEmail,
        displayName: name,
        passwordHash,
        authProvider: 'password',
        lastLoginAt: new Date(),
      })
      .returning();

    return { ok: true as const, user: inserted[0] };
  } catch (error) {
    console.error('Database error in registerEmailUser:', error);
    throw new Error('Unable to register account in database.', { cause: error });
  }
}

export async function verifyEmailUser(email: string, password: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const found = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (found.length === 0) {
      return { ok: false as const, error: 'Invalid email or password.' };
    }

    const user = found[0];
    if (!user.passwordHash) {
      return {
        ok: false as const,
        error: 'This email is linked to Google Sign-In. Please use Sign in with Google.',
      };
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return { ok: false as const, error: 'Invalid email or password.' };
    }

    const updated = await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();

    return { ok: true as const, user: updated[0] || user };
  } catch (error) {
    console.error('Database error in verifyEmailUser:', error);
    throw new Error('Unable to verify credentials.', { cause: error });
  }
}
