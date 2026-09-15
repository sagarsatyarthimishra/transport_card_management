"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function TransportLogo() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/25">
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M4 7.5C4 6.12 5.12 5 6.5 5h11C18.88 5 20 6.12 20 7.5v7c0 1.38-1.12 2.5-2.5 2.5h-11C5.12 17 4 15.88 4 14.5v-7Z"
          stroke="white"
          strokeWidth="1.8"
        />
        <path
          d="M4 10h16M7.5 14h.01M16.5 14h.01"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M7 19h.5M16.5 19h.5"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10.58 10.58a2 2 0 0 0 2.83 2.83M9.88 5.09A10.93 10.93 0 0 1 12 4.88c5 0 8.5 5.12 9.5 7.12a18.2 18.2 0 0 1-3.06 4.06M6.61 6.61A18.15 18.15 0 0 0 2.5 12c1 2 4.5 7.12 9.5 7.12a10.9 10.9 0 0 0 4.04-.77"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.8"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const signupSuccess = searchParams.get("signup") === "success";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to login.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (requestError) {
      console.error("Login request error:", requestError);

      setError("Unable to connect to the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-3 sm:p-5 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-7xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/20 sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[0.9fr_1.1fr]">
        {/* Brand panel */}
        <section className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />

          <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-4">
              <TransportLogo />

              <div>
                <p className="text-lg font-semibold tracking-tight">
                  Transport Department
                </p>

                <p className="text-sm text-slate-400">
                  Payment Management System
                </p>
              </div>
            </div>

            <div className="mt-24 max-w-lg">
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
                Secure • Simple • Smart
              </p>

              <h2 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
                Welcome back to your payment workspace.
              </h2>

              <p className="mt-6 max-w-md text-base leading-7 text-slate-400">
                Manage cards, create transaction files, validate payment
                details, and keep your transaction history organized.
              </p>
            </div>
          </div>

          <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-medium">
              Your data stays separated
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Each account has its own cards, transactions, files and reports.
            </p>
          </div>
        </section>

        {/* Login panel */}
        <section className="flex items-center justify-center bg-white px-5 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-md">
            {/* Mobile brand */}
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <TransportLogo />

              <div>
                <p className="font-semibold text-slate-900">
                  Transport Department
                </p>

                <p className="text-xs text-slate-500">
                  Payment Management System
                </p>
              </div>
            </div>

            <div className="mb-8">
              <p className="mb-2 text-sm font-semibold text-blue-600">
                Welcome back
              </p>

              <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                Sign in to your account
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Enter your account details to continue.
              </p>
            </div>

            {signupSuccess && (
              <div
                role="status"
                className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700"
              >
                Account created successfully. You can sign in now.
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="identifier"
                  className="text-sm font-medium text-slate-700"
                >
                  Email or username
                </Label>

                <Input
                  id="identifier"
                  name="identifier"
                  type="text"
                  placeholder="Enter email or username"
                  value={identifier}
                  onChange={(event) => {
                    setIdentifier(event.target.value);
                    setError("");
                  }}
                  autoComplete="username"
                  disabled={isLoading}
                  required
                  className="h-11 rounded-xl border-slate-200 bg-slate-50/50 px-4 transition focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-600/20"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-sm font-medium text-slate-700"
                  >
                    Password
                  </Label>

                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold text-blue-600 transition hover:text-blue-700 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                    autoComplete="current-password"
                    disabled={isLoading}
                    required
                    className="h-11 rounded-xl border-slate-200 bg-slate-50/50 px-4 pr-12 transition focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-600/20"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((previous) => !previous)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    <EyeIcon hidden={!showPassword} />
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full rounded-xl bg-blue-600 font-semibold shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 hover:shadow-blue-600/30"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <p className="mt-7 text-center text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-semibold text-blue-600 transition hover:text-blue-700 hover:underline"
              >
                Create account
              </Link>
            </p>

            <p className="mt-8 text-center text-xs leading-5 text-slate-400">
              Authorized users only. Your account data is isolated from other
              users.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}