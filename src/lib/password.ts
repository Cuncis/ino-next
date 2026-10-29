import bcrypt from "bcryptjs";

// Laravel writes bcrypt hashes as $2y$, which is the same algorithm as $2b$
export function verifyLaravelPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash.replace(/^\$2y\$/, "$2b$"));
}
