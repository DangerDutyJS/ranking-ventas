import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { hashPin } from './hash';

const leaderDoc = (storeId: string) => doc(db, 'tiendas', storeId, 'config', 'leader');

export async function leaderPasswordExists(storeId: string): Promise<boolean> {
  const snap = await getDoc(leaderDoc(storeId));
  return snap.exists() && !!snap.data()?.passwordHash;
}

export async function createLeaderPassword(storeId: string, password: string): Promise<void> {
  const passwordHash = await hashPin(password);
  await setDoc(leaderDoc(storeId), { passwordHash });
}

export async function verifyLeaderPassword(storeId: string, password: string): Promise<boolean> {
  const snap = await getDoc(leaderDoc(storeId));
  if (!snap.exists()) return false;
  const stored = snap.data()?.passwordHash as string;
  const input = await hashPin(password);
  return stored === input;
}
