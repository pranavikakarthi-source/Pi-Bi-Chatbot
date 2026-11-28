"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import AuthBoxShell from "@/components/auth/AuthBoxShell";

function validateUsername(value) {
  return /^[a-zA-Z0-9_.]{3,30}$/.test(value.trim());
}

function validateName(value) {
  return value.trim().length >= 2;
}

function validatePhone(value) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return (
    /^[+\d][\d\s()-]{6,20}$/.test(trimmed) &&
    digits.length >= 7 &&
    digits.length <= 15
  );
}

function validateDob(value) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
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

function formatDobInput(rawValue) {
  const digits = rawValue.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

function GreenCheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 text-[#1b7f46] dark:text-emerald-400 shrink-0"
      aria-hidden="true"
    >
      <path
        d="M4 10.5L8 14.5L16 6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileUnderlineField({
  id,
  label,
  value,
  onChange,
  placeholder,
  isValid,
  type = "text",
  inputMode,
  maxLength,
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[13px] font-medium text-[#2b8c98] dark:text-[#4eb8c7] mb-1.5"
      >
        {label}
      </label>
      <div
        className={`flex items-center gap-2 border-b pb-2 transition-colors ${
          isValid
            ? "border-[#1f1f1f] dark:border-neutral-500"
            : "border-[#2b8c98]/60 dark:border-[#4eb8c7]/40 focus-within:border-[#2b8c98] dark:focus-within:border-[#4eb8c7]"
        }`}
      >
        <input
          id={id}
          name={id}
          type={type}
          inputMode={inputMode}
          maxLength={maxLength}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-transparent text-[15px] text-[#111111] dark:text-neutral-100 placeholder:text-[#7a7a7a] dark:placeholder:text-neutral-500 outline-none"
        />
        {isValid && <GreenCheckIcon />}
      </div>
    </div>
  );
}

export default function ProfileSetupForm({ initialProfile }) {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [username, setUsername] = useState(initialProfile?.username || "");
  const [fullName, setFullName] = useState(initialProfile?.fullName || "");
  const [phone, setPhone] = useState(initialProfile?.phone || "");
  const [about, setAbout] = useState(initialProfile?.about || "");
  const [dateOfBirth, setDateOfBirth] = useState(
    initialProfile?.dateOfBirth || ""
  );

  const [avatarFile, setAvatarFile] = useState(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const previewUrl = localPreviewUrl || initialProfile?.avatarUrl || "";

  const isUsernameValid = validateUsername(username);
  const isNameValid = validateName(fullName);
  const isPhoneValid = validatePhone(phone);
  const isAboutValid = about.trim().length >= 2 && about.trim().length <= 160;
  const isDobValid = validateDob(dateOfBirth);
  const isFormComplete =
    isUsernameValid && isNameValid && isPhoneValid && isDobValid;

  function handleAvatarSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please choose a valid image file (JPG, PNG, WebP, or GIF).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Profile photo must be 5 MB or smaller.");
      return;
    }

    setErrorMessage("");
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setAvatarFile(file);
    setLocalPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isFormComplete || isSaving) return;

    setErrorMessage("");
    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.append("username", username.trim());
      formData.append("fullName", fullName.trim());
      formData.append("phone", phone.trim());
      formData.append("about", about.trim());
      formData.append("dateOfBirth", dateOfBirth.trim());
      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      const response = await fetch("/api/profile", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorMessage(data?.error || "Unable to save profile details.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleBack() {
    if (initialProfile?.profileCompleted) {
      router.push("/");
    } else {
      router.back();
    }
  }

  const backButton = (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Go back"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#1f1f1f] dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
    </button>
  );

  return (
    <AuthBoxShell leftAction={backButton} maxWidthClass="max-w-[460px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-[#111111] dark:text-white">
          Set up your profile
        </h1>
        <p className="mt-1 text-[13.5px] text-[#667085] dark:text-neutral-400">
          Add your photo and details so people can recognize you in chat
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarSelect}
              className="hidden"
              aria-label="Upload profile photo"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label={
                previewUrl ? "Change profile photo" : "Upload profile photo"
              }
              className={`group relative h-[104px] w-[104px] rounded-[30px] overflow-hidden flex items-center justify-center transition cursor-pointer ${
                previewUrl
                  ? "shadow-lg shadow-black/10 dark:shadow-black/40 ring-1 ring-black/10 dark:ring-white/15"
                  : "bg-[#2b8c98] border border-neutral-900/20 dark:border-white/20 hover:bg-[#247a85]"
              }`}
            >
              {previewUrl ? (
                <>
                  <Image
                    unoptimized
                    src={previewUrl}
                    alt="Profile photo preview"
                    width={104}
                    height={104}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                    Change
                  </span>
                </>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8 text-[#111111] dark:text-white"
                  aria-hidden="true"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </button>
          </div>

          <div className="space-y-6">
            <ProfileUnderlineField
              id="profile-username"
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              isValid={isUsernameValid}
            />

            <ProfileUnderlineField
              id="profile-name"
              label="Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              isValid={isNameValid}
            />

            <ProfileUnderlineField
              id="profile-phone"
              label="Phone Number"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9876543210"
              isValid={isPhoneValid}
            />

            <ProfileUnderlineField
              id="profile-about"
              label="About"
              maxLength={160}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Hey there! I am using PingMe."
              isValid={isAboutValid}
            />

            <ProfileUnderlineField
              id="profile-dob"
              label="Date of Birth"
              inputMode="numeric"
              maxLength={10}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(formatDobInput(e.target.value))}
              placeholder="Your birthday (dd-mm-yyyy)"
              isValid={isDobValid}
            />
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-4 py-2.5 text-[13px] text-red-700 dark:text-red-300 text-center"
            >
              {errorMessage}
            </p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={!isFormComplete || isSaving}
              className={`w-full h-[52px] rounded-full text-white text-[15px] font-medium inline-flex items-center justify-center gap-2 transition cursor-pointer ${
                isFormComplete
                  ? "bg-[#2b8c98] hover:bg-[#237782] shadow-lg shadow-[#2b8c98]/25 active:scale-[0.99]"
                  : "bg-[#8bbbd0] dark:bg-[#2a5460] cursor-not-allowed opacity-90"
              }`}
            >
              <span>{isSaving ? "Saving..." : "Complete"}</span>
              {!isSaving && (
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    d="M4 10.5L8 14.5L16 6"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </form>
    </AuthBoxShell>
  );
}
