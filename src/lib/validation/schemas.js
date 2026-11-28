import { z } from "zod";

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const PHONE_REGEX = /^\d{10}$/;
export const USERNAME_REGEX = /^[a-zA-Z0-9_.]{3,30}$/;
export const OTP_REGEX = /^\d{6}$/;
export const DOB_REGEX = /^(\d{2})-(\d{2})-(\d{4})$/;

export function isValidCalendarDob(value) {
  const match = DOB_REGEX.exec(String(value || "").trim());
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const currentYear = new Date().getFullYear();

  if (year < 1900 || year > currentYear || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export const emailSchema = z
  .string({ error: "Please enter a valid email address." })
  .trim()
  .toLowerCase()
  .regex(EMAIL_REGEX, "Please enter a valid email address.");

export const phoneSchema = z
  .string({ error: "Phone number must be exactly 10 digits." })
  .trim()
  .regex(PHONE_REGEX, "Phone number must be exactly 10 digits.");

export const usernameSchema = z
  .string({ error: "Username is required." })
  .trim()
  .regex(
    USERNAME_REGEX,
    "Username must be 3–30 characters using letters, numbers, underscores, or dots."
  );

export const otpSchema = z
  .string({ error: "Please enter a valid 6-digit OTP." })
  .trim()
  .regex(OTP_REGEX, "Please enter a valid 6-digit OTP.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: "Password is required." })
    .min(1, "Password is required."),
});

export const sendOtpSchema = z.object({
  email: emailSchema,
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
});

export const completeSignupSchema = z
  .object({
    password: z
      .string({ error: "Password must contain at least 6 characters." })
      .min(6, "Password must contain at least 6 characters."),
    confirmPassword: z
      .string({ error: "Please confirm your password." })
      .min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const profileSetupSchema = z.object({
  username: usernameSchema,
  fullName: z
    .string({ error: "Please enter your name (at least 2 characters)." })
    .trim()
    .min(2, "Please enter your name (at least 2 characters).")
    .max(80, "Name must be 80 characters or fewer."),
  phone: phoneSchema,
  about: z
    .string()
    .trim()
    .max(160, "About must be 160 characters or fewer.")
    .optional()
    .default(""),
  dateOfBirth: z
    .string({ error: "Please enter a valid Date of Birth in dd-mm-yyyy format." })
    .trim()
    .refine(
      isValidCalendarDob,
      "Please enter a valid Date of Birth in dd-mm-yyyy format."
    ),
});

export function getFirstZodError(result, fallback = "Invalid input provided.") {
  return result?.error?.issues?.[0]?.message || fallback;
}
