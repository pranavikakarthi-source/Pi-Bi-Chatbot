"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthBoxShell from "./AuthBoxShell";
import EyeIcon from "./EyeIcon";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 45;

function PasswordInput({
  id,
  label,
  value,
  onChange,
  showPassword,
  onToggle,
  placeholder = "********",
  autoComplete = "new-password",
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[14px] font-medium text-[#1f1f1f] dark:text-neutral-200 mb-2"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={6}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full h-[48px] rounded-full bg-[#f7f7f7] dark:bg-[#111b21] border border-[#e5e5e5] dark:border-neutral-700 pl-5 pr-12 text-[14px] text-[#111111] dark:text-neutral-100 placeholder:text-[#8c8c8c] dark:placeholder:text-neutral-500 outline-none transition focus:border-[#b3b3b3] focus:bg-white dark:focus:bg-[#162229]"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#333333] dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer p-1"
        >
          <EyeIcon visible={showPassword} />
        </button>
      </div>
    </div>
  );
}

async function postJson(endpoint, body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Request failed. Please try again.");
  }

  return data;
}

export default function SignUpFlow() {
  const router = useRouter();

  const [step, setStep] = useState("email"); // "email" | "otp" | "password"
  const [email, setEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(() => Array(OTP_LENGTH).fill(""));
  const [resendTimer, setResendTimer] = useState(0);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const otpInputRefs = useRef([]);

  useEffect(() => {
    if (step !== "otp" || resendTimer <= 0) return;

    const timerId = window.setTimeout(() => {
      setResendTimer((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [step, resendTimer]);

  useEffect(() => {
    if (step === "otp") {
      otpInputRefs.current[0]?.focus();
    }
  }, [step]);

  async function handleSendOtp(event) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    setIsLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    try {
      await postJson("/api/auth/send-otp", { email: normalizedEmail });
      setEmail(normalizedEmail);
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setResendTimer(RESEND_SECONDS);
      setStep("otp");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to send OTP. Please check your email and try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendOtp() {
    if (resendTimer > 0 || isLoading) return;
    setErrorMessage("");
    setStatusMessage("");
    setIsLoading(true);

    try {
      await postJson("/api/auth/send-otp", { email });
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setResendTimer(RESEND_SECONDS);
      setStatusMessage("A new 6-digit OTP has been sent to your email.");
      otpInputRefs.current[0]?.focus();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to resend OTP."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleOtpChange(index, rawValue) {
    const digitsOnly = rawValue.replace(/\D/g, "");
    if (!digitsOnly) {
      setOtpDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }

    if (digitsOnly.length > 1) {
      const chars = digitsOnly.slice(0, OTP_LENGTH).split("");
      setOtpDigits((prev) => {
        const next = [...prev];
        chars.forEach((char, offset) => {
          if (index + offset < OTP_LENGTH) {
            next[index + offset] = char;
          }
        });
        return next;
      });
      const focusIdx = Math.min(index + chars.length, OTP_LENGTH - 1);
      otpInputRefs.current[focusIdx]?.focus();
      return;
    }

    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = digitsOnly;
      return next;
    });

    if (index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index, event) {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpPaste(event) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();

    const chars = pasted.slice(0, OTP_LENGTH).split("");
    setOtpDigits(() => {
      const next = Array(OTP_LENGTH).fill("");
      chars.forEach((char, idx) => {
        next[idx] = char;
      });
      return next;
    });

    const focusIdx = Math.min(chars.length, OTP_LENGTH - 1);
    otpInputRefs.current[focusIdx]?.focus();
  }

  async function handleVerifyOtp(event) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");

    const token = otpDigits.join("");
    if (token.length !== OTP_LENGTH) {
      setErrorMessage(
        `Please enter the ${OTP_LENGTH}-digit OTP sent to your email.`
      );
      return;
    }

    setIsLoading(true);
    try {
      await postJson("/api/auth/verify-otp", { email, otp: token });
      setStep("password");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Invalid or expired OTP."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCompleteSignup(event) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");

    if (password.length < 6) {
      setErrorMessage("Password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await postJson("/api/auth/complete-signup", {
        password,
        confirmPassword,
      });

      router.push("/profile-setup");
      router.refresh();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to create account. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  const otpCode = otpDigits.join("");

  const stepNumber = step === "email" ? 1 : step === "otp" ? 2 : 3;
  const stepLabel =
    step === "email"
      ? "Email verification"
      : step === "otp"
        ? "Enter OTP code"
        : "Set your password";

  const backToEmailButton =
    step === "otp" ? (
      <button
        type="button"
        onClick={() => {
          setErrorMessage("");
          setStatusMessage("");
          setStep("email");
        }}
        aria-label="Back to email step"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f5] dark:bg-neutral-800 text-[#1f1f1f] dark:text-neutral-200 hover:bg-[#ebebeb] dark:hover:bg-neutral-700 transition-colors cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>
    ) : null;

  return (
    <AuthBoxShell leftAction={backToEmailButton} maxWidthClass="max-w-[440px]">
      <div>
        <div className="text-center mb-5">
          <h1 className="text-[32px] font-bold tracking-[-0.025em] text-[#111111] dark:text-neutral-100 leading-tight">
            Sign up
          </h1>
          <p className="mt-1.5 text-[14px] text-[#737373] dark:text-neutral-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-[#2b8cff] underline underline-offset-2 hover:text-[#1a73e8] transition-colors"
            >
              Login
            </Link>
          </p>
        </div>

        {/* Step progress bar (inspired by card step layout) */}
        <div className="mb-6 rounded-2xl bg-neutral-50 dark:bg-[#0b141a] border border-neutral-200/70 dark:border-neutral-800 px-3.5 py-2.5 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
            {stepLabel}
          </span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((idx) => (
                <span
                  key={idx}
                  className={`h-1.5 w-4 rounded-full transition-colors ${
                    idx <= stepNumber
                      ? "bg-[#2b8c98]"
                      : "bg-neutral-200 dark:bg-neutral-700"
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {stepNumber} of 3
            </span>
          </div>
        </div>

        {step === "email" && (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <label
                htmlFor="signup-email"
                className="block text-[14px] font-medium text-[#1f1f1f] dark:text-neutral-200 mb-2"
              >
                Enter your email
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@mail.com"
                className="w-full h-[48px] rounded-full bg-[#f7f7f7] dark:bg-[#111b21] border border-[#e5e5e5] dark:border-neutral-700 px-5 text-[14px] text-[#111111] dark:text-neutral-100 placeholder:text-[#8c8c8c] dark:placeholder:text-neutral-500 outline-none transition focus:border-[#b3b3b3] focus:bg-white dark:focus:bg-[#162229]"
              />
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
              {isLoading ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="text-center">
              <h2 className="text-[20px] font-semibold text-[#111111] dark:text-neutral-100">
                You have received an OTP
              </h2>
              <p className="mt-2 text-[14px] text-[#737373] dark:text-neutral-400 leading-relaxed">
                We&rsquo;ve sent a {OTP_LENGTH}-digit verification code to{" "}
                <span className="font-medium text-[#111111] dark:text-neutral-100">
                  {email}
                </span>
                . Enter the code below to verify your account.
              </p>
            </div>

            <div>
              <label className="block text-[14px] font-medium text-[#1f1f1f] dark:text-neutral-200 mb-3 text-center">
                Enter OTP
              </label>
              <div
                className="flex items-center justify-center gap-2.5"
                onPaste={handleOtpPaste}
              >
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpInputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={OTP_LENGTH}
                    aria-label={`OTP digit ${index + 1}`}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="h-12 w-12 rounded-full bg-[#f7f7f7] dark:bg-[#111b21] border border-[#e5e5e5] dark:border-neutral-700 text-center text-[18px] font-semibold text-[#111111] dark:text-neutral-100 outline-none transition focus:border-[#111111] dark:focus:border-[#4eb8c7] focus:bg-white dark:focus:bg-[#162229] focus:ring-2 focus:ring-[#111111]/10 dark:focus:ring-[#4eb8c7]/20"
                  />
                ))}
              </div>
            </div>

            <div className="text-center text-[13px] text-[#737373] dark:text-neutral-400">
              {resendTimer > 0 ? (
                <p>You can resend the code in {resendTimer} seconds</p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  className="text-[#2b8cff] underline underline-offset-2 hover:text-[#1a73e8] font-medium cursor-pointer disabled:opacity-50"
                >
                  Resend code
                </button>
              )}
            </div>

            {statusMessage && (
              <p
                role="status"
                className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 px-4 py-2.5 text-[13px] text-emerald-700 dark:text-emerald-300 text-center"
              >
                {statusMessage}
              </p>
            )}

            {errorMessage && (
              <p
                role="alert"
                className="rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-4 py-2.5 text-[13px] text-red-700 dark:text-red-300 text-center"
              >
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || otpCode.length !== OTP_LENGTH}
              className="w-full h-[48px] rounded-full bg-[#050505] dark:bg-[#2b8c98] text-white text-[15px] font-medium hover:bg-[#1f1f1f] dark:hover:bg-[#237782] active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? "Verifying OTP..." : "Verify OTP"}
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handleCompleteSignup} className="space-y-5">
            <div className="rounded-2xl bg-[#f7f7f7] dark:bg-[#111b21] border border-[#e5e5e5] dark:border-neutral-700 px-4 py-3 text-center">
              <p className="text-[13px] text-[#525252] dark:text-neutral-300">
                Verified email:{" "}
                <span className="font-medium text-[#111111] dark:text-neutral-100">
                  {email}
                </span>
              </p>
            </div>

            <PasswordInput
              id="signup-password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              showPassword={showPassword}
              onToggle={() => setShowPassword((prev) => !prev)}
            />

            <PasswordInput
              id="signup-confirm-password"
              label="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              showPassword={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((prev) => !prev)}
            />

            <p className="text-[12px] text-[#737373] dark:text-neutral-400 px-1">
              Must contain at least 6 characters.
            </p>

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
              {isLoading ? "Creating account..." : "Sign up"}
            </button>
          </form>
        )}
      </div>
    </AuthBoxShell>
  );
}
