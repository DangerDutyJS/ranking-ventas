import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const LEADER_DOC = doc(db, 'config', 'leader');

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function leaderPasswordExists(): Promise<boolean> {
  const snap = await getDoc(LEADER_DOC);
  return snap.exists() && !!snap.data()?.passwordHash;
}

export async function createLeaderPassword(password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  await setDoc(LEADER_DOC, { passwordHash });
}

export async function verifyLeaderPassword(password: string): Promise<boolean> {
  const snap = await getDoc(LEADER_DOC);
  if (!snap.exists()) return false;
  const stored = snap.data()?.passwordHash as string;
  const input = await hashPassword(password);
  return stored === input;
}
