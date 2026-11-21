import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';

const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || EPHEMERAL_FALLBACK_SECRET;
}

export interface VerifiedSessionUser {
  uid: string;
  email: string;
  name?: string;
  provider: 'google' | 'password';
}

export interface AuthRequest extends Request {
  user?: VerifiedSessionUser;
}

export function signSessionToken(payload: VerifiedSessionUser): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24; // 24h
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
  return `vw.${body}.${sig}`;
}

export function verifySessionToken(token: string): VerifiedSessionUser | null {
  if (!token.startsWith('vw.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(body)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as VerifiedSessionUser & {
      exp?: number;
    };
    if (!decoded.exp || decoded.exp < Date.now()) return null;
    if (!decoded.uid || !decoded.email) return null;
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      provider: decoded.provider || 'password',
    };
  } catch {
    return null;
  }
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Empty authentication token' });
    return;
  }

  // Check server-signed email/password session token first
  if (token.startsWith('vw.')) {
    const sessionUser = verifySessionToken(token);
    if (!sessionUser) {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired session token' });
      return;
    }
    req.user = sessionUser;
    next();
    return;
  }

  // Verify Firebase Google ID token
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || `${decodedToken.uid}@veilwatch.local`,
      name: decodedToken.name,
      provider: 'google',
    };
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid authentication token' });
  }
};
