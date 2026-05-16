import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { hashWithSalt, verifyWithSalt, legacyHash } from './hash';

const leaderDoc = (storeId: string) => doc(db, 'tiendas', storeId, 'config', 'leader');

export async function leaderPasswordExists(storeId: string): Promise<boolean> {
  const snap = await getDoc(leaderDoc(storeId));
  return snap.exists() && !!snap.data()?.passwordHash;
}

export async function createLeaderPassword(storeId: string, password: string): Promise<void> {
  const { hash, salt } = await hashWithSalt(password);
  await setDoc(leaderDoc(storeId), { passwordHash: hash, passwordSalt: salt });
}

export async function verifyLeaderPassword(storeId: string, password: string): Promise<boolean> {
  const snap = await getDoc(leaderDoc(storeId));
  if (!snap.exists()) return false;
  const { passwordHash, passwordSalt } = snap.data() as { passwordHash: string; passwordSalt?: string };
  if (passwordSalt) {
    return verifyWithSalt(password, passwordHash, passwordSalt);
  }
  // Migración: hash legacy SHA-256 sin sal
  return (await legacyHash(password)) === passwordHash;
}
