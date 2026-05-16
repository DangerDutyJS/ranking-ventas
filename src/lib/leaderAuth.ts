import { doc, getDoc, setDoc } from 'firebase/firestore';
import { sendSignInLinkToEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { db, auth } from './firebase';
import { hashWithSalt, verifyWithSalt, legacyHash } from './hash';

const leaderDoc = (storeId: string) => doc(db, 'tiendas', storeId, 'config', 'leader');

const RESET_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3000/reset'
    : 'https://ranking-ventas.web.app/reset';

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
  return (await legacyHash(password)) === passwordHash;
}

export async function sendLeaderResetLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(auth, email, {
    url: RESET_URL,
    handleCodeInApp: true,
  });
  localStorage.setItem('leaderResetEmail', email);
}

export async function completeLeaderReset(user: User, href: string): Promise<void> {
  const email = localStorage.getItem('leaderResetEmail') ?? user.email ?? '';
  const credential = EmailAuthProvider.credentialWithLink(email, href);
  await reauthenticateWithCredential(user, credential);
  localStorage.removeItem('leaderResetEmail');
}
