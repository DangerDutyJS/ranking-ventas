import { doc, getDoc, setDoc } from 'firebase/firestore';
import { reauthenticateWithPopup } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { db, auth, googleProvider } from './firebase';
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
  if (passwordSalt) return verifyWithSalt(password, passwordHash, passwordSalt);
  return (await legacyHash(password)) === passwordHash;
}

export async function reauthWithGoogle(): Promise<void> {
  const user: User | null = auth.currentUser;
  if (!user) throw new Error('No hay sesión activa.');
  await reauthenticateWithPopup(user, googleProvider);
}
