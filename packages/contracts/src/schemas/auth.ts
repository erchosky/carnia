import { z } from 'zod';

export const UsernameSchema = z
  .string()
  .trim()
  .min(3, 'Mínimo 3 caracteres')
  .max(20, 'Máximo 20 caracteres')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Solo letras, números, guiones y guion bajo');

/** bcrypt ignora a partir del byte 72, así que limitamos la longitud. */
export const PasswordSchema = z.string().min(8, 'Mínimo 8 caracteres').max(72, 'Máximo 72 caracteres');

export const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Email no válido')),
  username: UsernameSchema,
  password: PasswordSchema,
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Email no válido')),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof RefreshSchema>;

export const UpdateUsernameSchema = z.object({ username: UsernameSchema });
export type UpdateUsernameInput = z.infer<typeof UpdateUsernameSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es obligatoria'),
  newPassword: PasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const PublicUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  xp: z.number(),
  level: z.number(),
  createdAt: z.string(),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const AuthResponseSchema = z.object({
  user: PublicUserSchema,
  tokens: AuthTokensSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
