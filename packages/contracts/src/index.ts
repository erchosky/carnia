import { z } from 'zod';

// Mensajes de error por defecto de Zod en español para web y API.
z.config(z.locales.es());

export * from './constants/game.js';
export * from './constants/achievements.js';
export * from './schemas/auth.js';
export * from './schemas/question.js';
export * from './schemas/solo.js';
export * from './schemas/match.js';
export * from './schemas/room.js';
export * from './schemas/leaderboard.js';
export * from './schemas/daily.js';
export * from './schemas/study.js';
export * from './schemas/user.js';
export * from './events/client-to-server.js';
export * from './events/server-to-client.js';
