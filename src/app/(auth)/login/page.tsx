import { Suspense } from "react";

import LoginForm from "./LoginForm";

function LoginLoading() {
  return (
    <main className="min-h-screen bg-slate-950 p-3 sm:p-5 lg:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-7xl items-center justify-center rounded-3xl bg-white shadow-2xl shadow-black/20 sm:min-h-[calc(100vh-2.5rem)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />

          <p className="text-sm text-slate-500">
            Loading...
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}