import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function crearNotificacion(
  storeId: string,
  asesorId: string,
  asesorNombre: string,
  descripcion: string,
) {
  try {
    await addDoc(collection(db, 'tiendas', storeId, 'notificaciones'), {
      asesorId,
      asesorNombre,
      descripcion,
      creadoEn: serverTimestamp(),
    });
  } catch {
    // no bloquear la acción principal si falla la notificación
  }
}
