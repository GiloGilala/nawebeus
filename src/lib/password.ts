const SPECIAL_CHARS = [
  "!",
  "@",
  "#",
  "$",
  "%",
  "^",
  "&",
  "*",
  "(",
  ")",
  "_",
  "+",
  "-",
  "=",
  "[",
  "]",
  "{",
  "}",
  "|",
  ";",
  ":",
  ",",
  ".",
  "<",
  ">",
  "?",
];

const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "password123!",
  "password1!",
  "p@ssw0rd123",
  "password1",
  "123456789012",
  "1234567890123",
  "qwertyuiop",
  "qwerty123456",
  "abc123abc123",
  "letmein12345",
  "welcome12345",
  "welcome1!",
  "adminadmin12",
  "iloveyou1234",
  "monkey123456",
  "changeme1234",
  "passw0rd1234",
  "superman1234",
  "trustno11234",
  "football1234",
  "baseball1234",
  "master123!!!",
  "Password123!",
  "P@ssw0rd123!",
  "P@ssword1234",
]);

export const PASSWORD_RULES = {
  MIN_LENGTH: 12,
  MAX_LENGTH: 128,
  HISTORY_SIZE: 5,
};

export interface PasswordValidationOptions {
  username?: string;
  email?: string;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePassword(
  password: string,
  options?: PasswordValidationOptions,
): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < PASSWORD_RULES.MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_RULES.MIN_LENGTH} characters`);
  }

  if (password.length > PASSWORD_RULES.MAX_LENGTH) {
    errors.push(`Password must be at most ${PASSWORD_RULES.MAX_LENGTH} characters`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter (A–Z)");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter (a–z)");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number (0–9)");
  }

  const hasSpecial = SPECIAL_CHARS.some((ch) => password.includes(ch));
  if (!hasSpecial) {
    errors.push(
      "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)",
    );
  }

  if (/\s/.test(password)) {
    errors.push("Password must not contain spaces");
  }

  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    errors.push("Password is too common");
  }

  if (options?.username && password.toLowerCase().includes(options.username.toLowerCase())) {
    errors.push("Password must not contain the username");
  }

  if (options?.email) {
    const emailLocal = options.email.split("@")[0];
    if (
      emailLocal &&
      emailLocal.length >= 3 &&
      password.toLowerCase().includes(emailLocal.toLowerCase())
    ) {
      errors.push("Password must not contain the email address");
    }
  }

  return { valid: errors.length === 0, errors };
}
