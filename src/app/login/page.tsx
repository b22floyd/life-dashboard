import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Life Dashboard
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Sign in to continue
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
