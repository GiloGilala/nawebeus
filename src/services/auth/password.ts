export async function hashPassword(plaintext: string): Promise<string> {
  return await Bun.password.hash(plaintext, {
    algorithm: "bcrypt",
    cost: 10,
  });
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(plaintext, hash);
}
