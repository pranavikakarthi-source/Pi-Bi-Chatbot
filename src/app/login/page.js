import AuthForm from "@/components/auth/AuthForm";

export const metadata = {
  title: "Login to your account",
  description: "Sign in to access your real-time application.",
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
