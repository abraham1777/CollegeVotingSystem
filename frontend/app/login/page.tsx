"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isAdmin, sessionExpired, clearSessionExpiredBanner } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  // Parse and sanitize return URL (prevent open redirect vulnerabilities)
  const rawReturnUrl = searchParams.get("returnUrl") || "/";
  const returnUrl =
    rawReturnUrl.startsWith("/") && !rawReturnUrl.startsWith("//")
      ? rawReturnUrl
      : "/";

  // Check query parameter for session expired
  const isExpiredParam = searchParams.get("expired") === "true";
  const hasExpired = sessionExpired || isExpiredParam;

  // If already authenticated as admin, redirect to destination
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      router.replace(returnUrl);
    }
  }, [isAuthenticated, isAdmin, router, returnUrl]);

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = "Institutional email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 4) {
      errors.password = "Password must be at least 4 characters.";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      await login(email.trim(), password);
      // Navigation happens on success
      router.push(returnUrl);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during authentication.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex justify-center items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-700 text-white flex items-center justify-center font-bold text-xl shadow-md">
            S
          </div>
          <div>
            <span className="text-xl font-bold text-slate-900 tracking-tight block">
              SmartVote
            </span>
            <span className="text-[10px] tracking-widest text-slate-500 uppercase font-semibold block">
              College Election Management
            </span>
          </div>
        </div>

        <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-slate-900">
          Administrator Sign In
        </h1>
        <p className="mt-1 text-center text-sm text-slate-600">
          Enter your college administrative credentials to manage elections and candidates.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
          {/* Session Expired Alert */}
          {hasExpired && (
            <div
              className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3"
              role="alert"
            >
              <span className="text-amber-600 text-lg leading-none" aria-hidden="true">
                ⚠️
              </span>
              <div className="flex-1 text-xs text-amber-800">
                <strong className="block font-semibold">Session Expired</strong>
                Your 30-minute JWT security token has expired. Please sign in again to continue administrative tasks.
              </div>
              <button
                type="button"
                onClick={clearSessionExpiredBanner}
                className="text-amber-500 hover:text-amber-700 text-xs font-bold px-1"
                aria-label="Dismiss banner"
              >
                ✕
              </button>
            </div>
          )}

          {/* Authentication Error Alert */}
          {errorMessage && (
            <div
              className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3"
              role="alert"
            >
              <span className="text-rose-600 text-lg leading-none" aria-hidden="true">
                ✕
              </span>
              <div className="text-xs text-rose-800 flex-1 leading-relaxed">
                <strong className="block font-semibold mb-0.5">Authentication Failed</strong>
                {errorMessage}
                {errorMessage.toLowerCase().includes("role 'student'") && (
                  <div className="mt-2.5 pt-2 border-t border-rose-200/80">
                    <Link
                      href="/student/login"
                      className="font-semibold text-purple-700 hover:text-purple-900 underline inline-flex items-center gap-1"
                    >
                      Go to Student Voter Sign In Portal →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Demo Credentials Helper Card */}
          <div className="mb-5 p-3.5 bg-purple-50/80 border border-purple-200/80 rounded-xl text-xs text-purple-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
            <div>
              <div className="font-semibold text-purple-900 flex items-center gap-1.5">
                <span>🔑</span>
                <span>Demo Administrator Credentials:</span>
              </div>
              <div className="text-[11px] text-purple-700 font-mono mt-0.5">
                abraham.admin@test.com • AdminPassword123!
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail("abraham.admin@test.com");
                setPassword("AdminPassword123!");
                setValidationErrors({});
                setErrorMessage(null);
              }}
              className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-semibold transition-colors self-start sm:self-auto cursor-pointer shadow-xs"
            >
              Auto-fill Credentials
            </button>
          </div>

          {/* Form */}
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Institutional Email
              </label>
              <div className="mt-1.5">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (validationErrors.email) {
                      setValidationErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  placeholder="admin@college.edu"
                  className={`block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-colors ${
                    validationErrors.email
                      ? "border-rose-400 bg-rose-50/20"
                      : "border-slate-300"
                  }`}
                  aria-invalid={validationErrors.email ? "true" : "false"}
                  aria-describedby={validationErrors.email ? "email-error" : undefined}
                />
                {validationErrors.email && (
                  <p id="email-error" className="mt-1 text-xs text-rose-600">
                    {validationErrors.email}
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Password
                </label>
              </div>
              <div className="mt-1.5 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (validationErrors.password) {
                      setValidationErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  placeholder="••••••••"
                  className={`block w-full rounded-lg border px-3 py-2 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-colors ${
                    validationErrors.password
                      ? "border-rose-400 bg-rose-50/20"
                      : "border-slate-300"
                  }`}
                  aria-invalid={validationErrors.password ? "true" : "false"}
                  aria-describedby={validationErrors.password ? "password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-slate-500 hover:text-slate-800"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
                {validationErrors.password && (
                  <p id="password-error" className="mt-1 text-xs text-rose-600">
                    {validationErrors.password}
                  </p>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-purple-700 hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin text-sm" aria-hidden="true">
                      ↻
                    </span>
                    Authenticating with FastAPI...
                  </span>
                ) : (
                  "Sign In to SmartVote"
                )}
              </button>
            </div>
          </form>

          {/* Quick Access Info */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="text-xs text-slate-500 space-y-1.5">
              <div className="flex items-center justify-between">
                <span>FastAPI Auth Endpoint:</span>
                <code className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">
                  POST /auth/login
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span>Token Expiration:</span>
                <span className="font-medium text-slate-700">30 minutes</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Security Scope:</span>
                <span className="font-medium text-slate-700">
                  Role-Based (require_admin)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Architecture Notice */}
        <div className="mt-6 p-4 rounded-xl bg-slate-100/80 border border-slate-200 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-800 mb-1">
            <span aria-hidden="true">🛡️</span> Server-Side Security Boundary
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            SmartVote uses cryptographically signed JWT tokens verified by the FastAPI backend. Administrative operations (election creation, candidate approval, and status changes) require validated server-side administrator authorization and cannot be bypassed via client-side manipulation.
          </p>
          <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/"
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1"
            >
              ← Return to Dashboard
            </Link>
            <span className="text-slate-300">•</span>
            <Link
              href="/student/login"
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1"
            >
              Student Voter Sign In →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f6f7fb] flex items-center justify-center">
          <div className="text-sm text-slate-600 flex items-center gap-2">
            <span className="animate-spin text-purple-600 font-bold">↻</span>
            Loading authentication portal...
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

