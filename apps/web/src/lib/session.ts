import { useAuthStore } from '@/stores/auth-store';
import { disconnectSocket } from './socket';

/**
 * Cierra la sesión local: borra tokens y corta el socket, que sigue
 * autenticado como el usuario anterior hasta que se desconecta.
 */
export function endSession(): void {
  disconnectSocket();
  useAuthStore.getState().clear();
}
