import bcrypt from "bcryptjs";

// Laravel writes bcrypt hashes as $2y$, which is the same algorithm as $2b$
export function verifyLaravelPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash.replace(/^\$2y\$/, "$2b$"));
}

/** Laravel's BCRYPT_ROUNDS. */
const BCRYPT_ROUNDS = 12;

/** A new password hash in Laravel's own `$2y$` form, so either app can check it. */
export async function hashLaravelPassword(plain: string): Promise<string> {
  return (await bcrypt.hash(plain, BCRYPT_ROUNDS)).replace(/^\$2b\$/, "$2y$");
}
