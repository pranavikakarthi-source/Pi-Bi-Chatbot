"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getFirstZodError, loginSchema } from "@/lib/validation/schemas";
import AuthBoxShell from "./AuthBoxShell";
import EyeIcon from "./EyeIcon";

const REMEMBER_EMAIL_KEY = "chatbot_remembered_email";

function subscribeRememberedEmail(callback) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getRememberedEmail() {
  try {
    return window.localStorage.getItem(REMEMBER_EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

function getEmptySnapshot() {
  return "";
}

export default function AuthForm() {
  const router = useRouter();

  const savedEmail = useSyncExternalStore(
    subscribeRememberedEmail,
    getRememberedEmail,
    getEmptySnapshot
  );

  const [emailInput, setEmailInput] = useState(null);
  const [password, setPassword] = useState("");
  const [rememberMeInput, setRememberMeInput] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const email = emailInput ?? savedEmail;
  const rememberMe = rememberMeInput ?? Boolean(savedEmail);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrorMessage(
        getFirstZodError(parsed, "Please enter a valid email and password.")
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorMessage(data?.error || "Invalid login credentials.");
        return;
      }

      try {
        if (rememberMe) {
          window.localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
        } else {
          window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      } catch {
        // Ignore storage access errors.
      }

      router.push(data?.redirectTo || "/");
      router.refresh();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthBoxShell maxWidthClass="max-w-[430px]">
      <div>
        <div className="text-center mb-7">
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[#111111] dark:text-neutral-100 leading-tight">
            Login to your account
          </h1>
          <p className="mt-2 text-[14px] text-[#737373] dark:text-neutral-400">
            Don&rsquo;t have an account?{" "}
            <Link
              href="/signup"
              className="text-[#2b8cff] underline underline-offset-2 hover:text-[#1a73e8] transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>

        <form noValidate onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-[14px] font-medium text-[#1f1f1f] dark:text-neutral-200 mb-2"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="yourname@mail.com"
              className="w-full h-[48px] rounded-full bg-[#f7f7f7] dark:bg-[#111b21] border border-[#e5e5e5] dark:border-neutral-700 px-5 text-[14px] text-[#111111] dark:text-neutral-100 placeholder:text-[#8c8c8c] dark:placeholder:text-neutral-500 outline-none transition focus:border-[#b3b3b3] focus:bg-white dark:focus:bg-[#162229]"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-[14px] font-medium text-[#1f1f1f] dark:text-neutral-200 mb-2"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="w-full h-[48px] rounded-full bg-[#f7f7f7] dark:bg-[#111b21] border border-[#e5e5e5] dark:border-neutral-700 pl-5 pr-12 text-[14px] text-[#111111] dark:text-neutral-100 placeholder:text-[#8c8c8c] dark:placeholder:text-neutral-500 outline-none transition focus:border-[#b3b3b3] focus:bg-white dark:focus:bg-[#162229]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#333333] dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer p-1"
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>
          </div>

          <div className="flex items-center pt-0.5">
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
              <span className="relative flex items-center justify-center">
                <input
                  id="remember-me"
                  name="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMeInput(e.target.checked)}
                  className="peer appearance-none h-[18px] w-[18px] rounded-[5px] border border-[#d4d4d4] dark:border-neutral-600 bg-white dark:bg-[#111b21] checked:bg-[#0a0a0a] dark:checked:bg-[#2b8c98] checked:border-[#0a0a0a] dark:checked:border-[#2b8c98] transition cursor-pointer"
                />
                <svg
                  viewBox="0 0 12 10"
                  fill="none"
                  className="pointer-events-none absolute h-2.5 w-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                  aria-hidden="true"
                >
                  <path
                    d="M1 5L4.5 8.5L11 1.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-[14px] text-[#333333] dark:text-neutral-300">
                Remember me
              </span>
            </label>
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-4 py-2.5 text-[13px] text-red-700 dark:text-red-300"
            >
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-[48px] rounded-full bg-[#050505] dark:bg-[#2b8c98] text-white text-[15px] font-medium hover:bg-[#1f1f1f] dark:hover:bg-[#237782] active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </AuthBoxShell>
  );
}
