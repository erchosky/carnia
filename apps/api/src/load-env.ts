/**
 * Carga `apps/api/.env` si existe, con el cargador nativo de Node (sustituye a dotenv).
 * En producción las variables llegan del entorno y el archivo no existe.
 */
try {
  process.loadEnvFile();
} catch {
  // Sin archivo .env.
}
