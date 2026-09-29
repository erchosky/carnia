import { useMemo } from 'react';

export type AlmagroMood = 'correct' | 'wrong' | 'timeout' | 'win' | 'lose' | 'draw' | 'perfect';

const PHRASES: Record<AlmagroMood, string[]> = {
  correct: [
    "¡ESO ES! ¡Eso es, eso es, eso es! ¡Muy bien!",
    "¡Perfecto! ¡Fenomenal! ¡Así se hace!",
    "¡Anda! ¡Qué bien! ¡Sí señor!",
    "¡Correcto! ¡Exactamente! ¡Brillante!",
    "¡Bien! ¡Muy bien! ¡Sigue así!",
    "¡Eso es! ¡Muy bien contestado! ¡Fenomenal!",
  ],
  wrong: [
    "¡NO, NO, NO! ¡Para, para, para! ¡Mecachis en la mar!",
    "¡Que nos matamos! ¡Eso está MAL! ¡Fíjate bien!",
    "¡Ostras! ¡Eso no, eso no! ¡Por favor!",
    "¡Ay, ay, ay! ¡Mecachis! ¡Eso es un peligro, eh!",
    "¡No! ¡Eso es incorrecto! ¡Toma nota para el examen!",
    "¡Para el carro! ¡Así suspendemos seguro!",
  ],
  timeout: [
    "¡No contestas y el tiempo se acaba! ¡Hay que decidir!",
    "¡Mecachis! ¡Se acabó el tiempo! ¡En el examen no se puede dudar así!",
    "¡El tiempo no espera! ¡Hay que ser más rápido!",
  ],
  win: [
    "¡CAMPEÓN! ¡Eso es lo que hay! ¡Fenomenal!",
    "¡Has ganado! ¡Así se hace! ¡A este paso sacas el carné a la primera!",
    "¡Victoria! ¡Muy bien! ¡Sigue estudiando que vas muy bien!",
    "¡Magnífico! ¡Eres el número uno! ¡Enhorabuena!",
  ],
  lose: [
    "¡Ay, mecachis! ¡Has perdido! ¡Hay que estudiar más, eh!",
    "¡Vuelve a intentarlo! ¡Los errores son para aprender!",
    "¡Esta vez no ha podido ser! ¡Pero no te rindas!",
    "¡Hay que repasar el temario! ¡Esto no puede volver a pasar!",
  ],
  draw: [
    "¡Empate! ¡Los dos habéis estado bien! ¡Pero se puede mejorar!",
    "¡Iguales! ¡Ninguno ha dado el cien por cien! ¡A practicar!",
  ],
  perfect: [
    "¡PERFECTO! ¡Todas correctas! ¡Increíble! ¡Este saca el carné con los ojos cerrados!",
    "¡Cien por cien de aciertos! ¡Fenomenal! ¡Eres un crack!",
  ],
};

export function getAlmagroPhrase(mood: AlmagroMood): string {
  const list = PHRASES[mood];
  return list[Math.floor(Math.random() * list.length)]!;
}

/**
 * Frase estable mientras no cambien `mood` ni `key` (p. ej. el índice de ronda).
 * Evita que la frase cambie en cada re-render del componente.
 */
export function useAlmagroPhrase(mood: AlmagroMood | null, key: string | number = ''): string | null {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` fuerza una frase nueva por ronda.
  return useMemo(() => (mood ? getAlmagroPhrase(mood) : null), [mood, key]);
}
