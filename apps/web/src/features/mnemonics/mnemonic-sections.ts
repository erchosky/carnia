/** Reglas mnemotécnicas del examen teórico (contenido estático). */
export interface MnemonicRule {
  title: string;
  shortcut: string;
  detail: string;
  emoji: string;
}

export interface MnemonicSection {
  id: string;
  title: string;
  emoji: string;
  rules: MnemonicRule[];
}

export const MNEMONIC_SECTIONS: MnemonicSection[] = [
  {
    id: 'priority',
    title: 'Prioridad e Intersecciones',
    emoji: '⚠️',
    rules: [
      {
        title: 'El de la derecha manda',
        shortcut: 'DERECHA = PRIORIDAD',
        detail: 'En intersecciones sin señalizar, siempre tiene prioridad el vehículo que viene por tu DERECHA. Excepciones: señal de prioridad, stop, ceda el paso o vehículo de emergencias.',
        emoji: '➡️',
      },
      {
        title: 'Orden de mando',
        shortcut: 'AGENTE > SEMÁFORO > SEÑAL > MARCA',
        detail: 'Cuando hay conflicto, la prioridad va: Agente de tráfico → Semáforo → Señal vertical → Marca vial. El policía siempre gana.',
        emoji: '👮',
      },
      {
        title: 'Rotonda: dentro tiene prioridad',
        shortcut: 'DENTRO > FUERA',
        detail: 'En una glorieta, los vehículos que ya circulan dentro tienen prioridad sobre los que quieren entrar. Señaliza con el intermitente derecho al salir.',
        emoji: '🔄',
      },
      {
        title: 'Semáforo apagado o en ámbar intermitente',
        shortcut: 'SEÑALES VERTICALES > DERECHA',
        detail: 'Si el semáforo está apagado o en ámbar intermitente, manda la señalización vertical (STOP, ceda el paso…). Si no hay ninguna, se aplica la prioridad de la derecha. Extrema la precaución.',
        emoji: '🚦',
      },
    ],
  },
  {
    id: 'speed',
    title: 'Límites de Velocidad',
    emoji: '⚡',
    rules: [
      {
        title: 'La regla 120-90-50-30',
        shortcut: '120 / 90 / 50 / 30',
        detail: 'Autopista/autovía: 120 km/h · Carretera convencional: 90 km/h · Ciudad general: 50 km/h · Ciudad un carril por sentido: 30 km/h · Zonas residenciales: 20 km/h.',
        emoji: '🏎️',
      },
      {
        title: 'Mínima en autopista',
        shortcut: 'AUTOPISTA MÍNIMO 60',
        detail: 'En autopistas y autovías la velocidad mínima es 60 km/h (para los vehículos que puedan alcanzarla). Ir más lento es peligroso y sancionable.',
        emoji: '🐢',
      },
      {
        title: 'Condiciones adversas = bajar',
        shortcut: 'MAL TIEMPO = MENOS VELOCIDAD',
        detail: 'Con lluvia, niebla o nieve debes adaptar la velocidad para poder detener el vehículo dentro de tu campo visual. No hay un número fijo: depende de la visibilidad.',
        emoji: '🌧️',
      },
    ],
  },
  {
    id: 'lighting',
    title: 'Alumbrado y Luces',
    emoji: '💡',
    rules: [
      {
        title: 'Las distancias de las luces largas',
        shortcut: '150 ENCUENTRO / 100 SEGUIMIENTO',
        detail: 'Cambia a luces cortas cuando te encuentres con otro vehículo a 150 m. Cuando vayas detrás de otro, baja a cortas a 100 m. Truco: 150 son las letras de "encuentro" (7 letras × ~21... o simplemente recuerda el mayor).',
        emoji: '🔦',
      },
      {
        title: 'Antiniebla trasera: solo con 50 o menos',
        shortcut: 'TRASERA = MENOS DE 50 METROS',
        detail: 'La antiniebla trasera (roja) solo se usa cuando la visibilidad es INFERIOR a 50 metros. Usarla sin niebla deslumbra a los de atrás y está sancionado.',
        emoji: '🔴',
      },
      {
        title: 'Túnel = luces de cruce siempre',
        shortcut: 'TÚNEL = LUCES SÍ O SÍ',
        detail: 'En túneles y pasos inferiores las luces de cruce son OBLIGATORIAS, aunque el túnel esté iluminado y aunque sea de día. Sin excepción.',
        emoji: '🚇',
      },
      {
        title: 'Posición: nunca solas de noche',
        shortcut: 'POSICIÓN ≠ ILUMINACIÓN',
        detail: 'Las luces de posición solo indican tu presencia, no iluminan la vía. Por la noche SIEMPRE deben ir acompañadas de las de cruce. Ir solo con luces de posición de noche es infracción grave.',
        emoji: '🟡',
      },
    ],
  },
  {
    id: 'firstaid',
    title: 'Primeros Auxilios — PAS',
    emoji: '🚑',
    rules: [
      {
        title: 'Protocolo PAS',
        shortcut: 'P → A → S',
        detail: 'PROTEGER la zona (triángulos, luces emergencia, alejarte del tráfico) → AVISAR al 112 → SOCORRER a los heridos (sin moverlos salvo peligro inmediato).',
        emoji: '🆘',
      },
      {
        title: 'No quites el casco al motorista',
        shortcut: 'CASCO = NO TOCAR',
        detail: 'NUNCA quites el casco a un motorista accidentado salvo que sea absolutamente necesario para reanimar. Puede tener lesión de columna y el movimiento del cuello podría matarle.',
        emoji: '⛑️',
      },
      {
        title: 'No dar de beber ni mover',
        shortcut: 'SIN AGUA + SIN MOVER',
        detail: 'No des agua ni comida a un herido (puede necesitar anestesia). No lo muevas salvo peligro inmediato (fuego, hundimiento). Si hay que moverlo, mantén alineación cabeza-cuello-columna.',
        emoji: '🚫',
      },
      {
        title: 'Posición lateral de seguridad',
        shortcut: 'INCONSCIENTE + RESPIRA = PLS',
        detail: 'Si el herido está inconsciente pero respira, colócalo en Posición Lateral de Seguridad (de lado) para evitar que se ahogue si vomita. Nunca para alguien que no respira.',
        emoji: '🛌',
      },
    ],
  },
  {
    id: 'alcohol',
    title: 'Alcohol y Drogas',
    emoji: '🍺',
    rules: [
      {
        title: 'Los límites del alcohol',
        shortcut: '0.5 / 0.3 / 0.0',
        detail: 'General: 0,5 g/l en sangre (0,25 mg/l en aire) · Noveles (<2 años carnet) y profesionales: 0,3 g/l (0,15 mg/l) · Vehículos de transporte de menores: 0,0.',
        emoji: '📊',
      },
      {
        title: 'La tasa no baja con trucos',
        shortcut: 'SOLO EL TIEMPO BAJA LA TASA',
        detail: 'Café, agua, ejercicio... NADA baja la tasa de alcohol. Solo el tiempo. El hígado elimina aproximadamente 0,10-0,15 g/l por hora.',
        emoji: '⏱️',
      },
    ],
  },
  {
    id: 'overtaking',
    title: 'Adelantamientos',
    emoji: '🏎️',
    rules: [
      {
        title: 'Las 3 prohibiciones de adelantar',
        shortcut: 'CURVA + CIMA + CRUCE',
        detail: 'Está PROHIBIDO adelantar en: curvas y cambios de rasante con visibilidad reducida, pasos a nivel, pasos de peatones, intersecciones (salvo excepciones) y cuando el de delante ya esté adelantando.',
        emoji: '🚫',
      },
      {
        title: 'Ciclistas: 1,5 metros sí o sí',
        shortcut: 'CICLISTA = 1,5 M MÍNIMO',
        detail: 'Al adelantar a un ciclista debes guardar al menos 1,5 metros de separación lateral. Puedes invadir el carril contrario aunque haya línea continua para garantizar esa distancia.',
        emoji: '🚴',
      },
    ],
  },
  {
    id: 'safety',
    title: 'Sistemas de Seguridad ADAS',
    emoji: '🔒',
    rules: [
      {
        title: 'ABS: pisa y no sueltes',
        shortcut: 'ABS = PISA FUERTE Y MANTÉN',
        detail: 'Con ABS, en frenada de emergencia pisa el freno A FONDO y MANTENLO pisado. No lo "bombees". El ABS impide el bloqueo automáticamente. Además puedes seguir girando el volante.',
        emoji: '🛑',
      },
      {
        title: 'ESP corrige el derrape',
        shortcut: 'ESP = ESTABILIDAD',
        detail: 'El ESP detecta que el coche se desvía de tu intención (derrape, subviraje) y frena selectivamente las ruedas que necesita para corregir. No te salva si vas demasiado rápido en curva.',
        emoji: '🔄',
      },
      {
        title: 'Sillita solo trasera (o airbag OFF)',
        shortcut: 'SILLA ATRÁS=SEGURO / DELANTE=AIRBAG OFF',
        detail: 'Una sillita orientada hacia atrás en el asiento del copiloto es PELIGROSÍSIMA si el airbag se dispara (golpea la cabeza del niño). Solo puede ir delante si el airbag del copiloto está DESACTIVADO.',
        emoji: '👶',
      },
    ],
  },
  {
    id: 'vulnerable',
    title: 'Usuarios Vulnerables',
    emoji: '🚶',
    rules: [
      {
        title: 'Peatón en paso de cebra: siempre primero',
        shortcut: 'ZEBRA = PEATÓN SIEMPRE PASA',
        detail: 'El peatón tiene preferencia en el paso de peatones siempre que esté cruzando o vaya a cruzar. Debes detener el vehículo si es necesario. No basta con reducir velocidad.',
        emoji: '🦓',
      },
      {
        title: 'Patinetes: NO en acera',
        shortcut: 'VMP = CARRIL BICI O VÍA 30',
        detail: 'Los Vehículos de Movilidad Personal (patinetes, etc.) NO pueden ir por aceras. Solo por carriles bici o calzadas con límite ≤30 km/h. Velocidad máxima: 25 km/h.',
        emoji: '🛴',
      },
      {
        title: 'Peatones en carretera: por la izquierda',
        shortcut: 'PIE + CARRETERA = IZQUIERDA',
        detail: 'Los peatones que caminan por carretera sin acera deben ir por la izquierda (de cara al tráfico) para ver los coches que vienen. De noche o con poca luz: chaleco reflectante obligatorio.',
        emoji: '🚶',
      },
    ],
  },
  {
    id: 'adverse',
    title: 'Condiciones Adversas',
    emoji: '🌧️',
    rules: [
      {
        title: 'Aquaplaning: no frenar bruscamente',
        shortcut: 'AQUAPLANING = SOLTAR + RECTO',
        detail: 'Si el coche "flota" sobre el agua (aquaplaning): suelta el acelerador SUAVEMENTE, no frenes bruscamente, no gires el volante. Espera a que las ruedas vuelvan a contactar y luego frena con cuidado.',
        emoji: '💧',
      },
      {
        title: 'Hielo: suavidad total',
        shortcut: 'HIELO = TODO SUAVE',
        detail: 'En hielo o nieve cualquier movimiento brusco (frenar, acelerar, girar) puede hacerte perder el control. Reduce la velocidad progresivamente con el freno motor. Los puentes y zonas sombreadas se hielan antes.',
        emoji: '🧊',
      },
      {
        title: 'Lluvia duplica la frenada',
        shortcut: 'LLUVIA = x2 DISTANCIA',
        detail: 'En calzada mojada la distancia de frenada puede DUPLICARSE. Aumenta la distancia de seguridad y reduce la velocidad. Con niebla, adapta la velocidad a tu campo visual.',
        emoji: '🌊',
      },
    ],
  },
  {
    id: 'ecodriving',
    title: 'Eco-conducción y Etiquetas',
    emoji: '🌱',
    rules: [
      {
        title: 'Las 4 etiquetas medioambientales DGT',
        shortcut: '0 / ECO / C / B',
        detail: '🟢 CERO (Cero emisiones): eléctrico, hidrógeno, PHEV >40km · 🔵 ECO: híbrido no enchufable, GNC, GLP · 🟡 C: gasolina o diésel Euro 6 · 🟠 B: gasolina Euro 4 o diésel Euro 4-5.',
        emoji: '🏷️',
      },
      {
        title: 'Conducción eficiente: cambiar de marcha pronto',
        shortcut: 'MARCHA LARGA = MENOS CONSUMO',
        detail: 'Para ahorrar combustible, sube de marcha pronto (entre 2.000-2.500 rpm en gasolina, 1.500-2.000 en diésel). Anticipate al tráfico para no frenar y volver a acelerar.',
        emoji: '⬆️',
      },
    ],
  },
];
