"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AuthUser } from "@/lib/auth";

function StudentLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: authUser, isStudent, loginStudent, logout } = useAuth();

  // State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [justLoggedInStudent, setJustLoggedInStudent] = useState<AuthUser | null>(null);

  // Return URL (defaults to the student voting portal)
  const rawReturnUrl = searchParams.get("returnUrl") || "/student/vote";
  const returnUrl =
    rawReturnUrl.startsWith("/") && !rawReturnUrl.startsWith("//")
      ? rawReturnUrl
      : "/student/vote";

  // Derive active student session from AuthContext or immediate login
  const authenticatedStudent = (isStudent && authUser) ? authUser : justLoggedInStudent;

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = "Institutional student email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid institutional email address (e.g., sreya@test.com).";
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
      const user = await loginStudent(email.trim(), password);
      setJustLoggedInStudent(user);
      // Give a brief moment for visual confirmation, then navigate to target
      setTimeout(() => {
        router.push(returnUrl);
      }, 600);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during student authentication.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutStudent = () => {
    logout();
    setJustLoggedInStudent(null);
    setEmail("");
    setPassword("");
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
              STUDENT VOTER PORTAL
            </span>
          </div>
        </div>

        <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-slate-900">
          Student Sign In
        </h1>
        <p className="mt-1 text-center text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
          Sign in with your registered college credentials to access your ballots and cast secret votes.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
          {/* Active Student Session Banner */}
          {authenticatedStudent ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <strong className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Active Student Session
                  </strong>
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">
                  {authenticatedStudent.full_name}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {authenticatedStudent.email} • Student ID #{authenticatedStudent.id}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Link
                  href={returnUrl}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-purple-700 hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-600 transition-colors text-center"
                >
                  Continue to Ballots & Voting →
                </Link>

                <button
                  type="button"
                  onClick={handleSignOutStudent}
                  className="w-full py-2 px-4 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                >
                  Sign Out / Switch Student Account
                </button>
              </div>
            </div>
          ) : (
            <>
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
                    {errorMessage.includes("role 'admin'") && (
                      <div className="mt-2 pt-2 border-t border-rose-200">
                        <Link
                          href="/login"
                          className="font-semibold text-purple-700 hover:text-purple-900 underline inline-flex items-center gap-1"
                        >
                          Go to Administrator Sign In Portal →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Demo Student Credentials Card */}
              <div className="mb-5 p-3.5 bg-purple-50/80 border border-purple-200/80 rounded-xl text-xs text-purple-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
                <div>
                  <div className="font-semibold text-purple-900 flex items-center gap-1.5">
                    <span>🎓</span>
                    <span>Demo Student Voter Credentials:</span>
                  </div>
                  <div className="text-[11px] text-purple-700 font-mono mt-0.5">
                    sreya@test.com • Password1234!
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("sreya@test.com");
                    setPassword("Password1234!");
                    setValidationErrors({});
                    setErrorMessage(null);
                  }}
                  className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-semibold transition-colors self-start sm:self-auto cursor-pointer shadow-xs"
                >
                  Auto-fill Credentials
                </button>
              </div>

              {/* Login Form */}
              <form className="space-y-5" onSubmit={handleSubmit} noValidate>
                {/* Institutional Student Email / ID Field (Requirement 2 & 3: matches StudentLogin schema) */}
                <div>
                  <label
                    htmlFor="student-email"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Institutional Student Email / ID
                  </label>
                  <div className="mt-1.5">
                    <input
                      id="student-email"
                      name="email"
                      type="email"
                      autoComplete="username email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (validationErrors.email) {
                          setValidationErrors((prev) => ({ ...prev, email: undefined }));
                        }
                      }}
                      placeholder="e.g. sreya@test.com"
                      className={`block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-colors ${
                        validationErrors.email
                          ? "border-rose-400 bg-rose-50/20"
                          : "border-slate-300"
                      }`}
                      aria-invalid={validationErrors.email ? "true" : "false"}
                      aria-describedby={validationErrors.email ? "email-error" : undefined}
                    />
                    {validationErrors.email ? (
                      <p id="email-error" className="mt-1 text-xs text-rose-600">
                        {validationErrors.email}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Enter your registered college student email address.
                      </p>
                    )}
                  </div>
                </div>

                {/* Password Field with Show/Hide Control (Requirement 2) */}
                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="student-password"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                    >
                      Password
                    </label>
                  </div>
                  <div className="mt-1.5 relative">
                    <input
                      id="student-password"
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
                      placeholder="••••••••••••"
                      className={`block w-full rounded-lg border px-3 py-2 pr-14 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-colors ${
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
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-medium text-slate-500 hover:text-slate-800"
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

                {/* Submit Button with Loading State (Requirement 2) */}
                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-purple-700 hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin text-sm" aria-hidden="true">
                          ↻
                        </span>
                        Authenticating with FastAPI...
                      </span>
                    ) : (
                      "Sign In to Vote"
                    )}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Navigation Links (Requirement 2: Student voting page & Main dashboard) */}
          <div className="mt-6 pt-5 border-t border-slate-100 space-y-2.5 text-xs text-center">
            <div>
              <span className="text-slate-500">First time voting? </span>
              <Link
                href="/student/register"
                className="font-semibold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1"
              >
                Register as Eligible Student →
              </Link>
            </div>

            <div>
              <Link
                href="/elections"
                className="text-slate-600 hover:text-purple-700 inline-flex items-center gap-1"
              >
                🗳️ View Active Ballots & Elections Catalog
              </Link>
            </div>

            <div className="flex items-center justify-center gap-4 text-slate-500 pt-1">
              <Link
                href="/"
                className="hover:text-slate-800 transition-colors"
              >
                ← Main Dashboard
              </Link>
              <span>•</span>
              <Link
                href="/login"
                className="hover:text-purple-700 transition-colors"
              >
                Administrator Portal
              </Link>
            </div>
          </div>
        </div>

        {/* Security Architecture & Ballot Secrecy Notice */}
        <div className="mt-6 p-4 rounded-xl bg-slate-100/80 border border-slate-200 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-800 mb-1">
            <span aria-hidden="true">🔒</span> Verifiable Ballot Secrecy
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            SmartVote ensures one-student, one-vote integrity. Your voter participation receipt is cryptographically separated from your secret ballot selection, guaranteeing that your vote remains strictly confidential.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function StudentLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f6f7fb] flex items-center justify-center">
          <div className="text-sm text-slate-600 flex items-center gap-2">
            <span className="animate-spin text-purple-600 font-bold">↻</span>
            Loading student portal...
          </div>
        </div>
      }
    >
      <StudentLoginForm />
    </Suspense>
  );
}

