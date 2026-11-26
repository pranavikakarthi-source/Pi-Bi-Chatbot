import SignUpFlow from "@/components/auth/SignUpFlow";

export const metadata = {
  title: "Sign up",
  description: "Create your account with email OTP verification.",
};

export default function SignupPage() {
  return <SignUpFlow />;
}
