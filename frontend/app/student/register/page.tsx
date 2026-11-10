"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerStudentUser, AuthUser } from "@/lib/auth";

function StudentRegisterForm() {
  const router = useRouter();

  // Form State
  const [collegeId, setCollegeId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    collegeId?: string;
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [registeredUser, setRegisteredUser] = useState<AuthUser | null>(null);

  const validate = (): boolean => {
    const errors: {
      collegeId?: string;
      fullName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!collegeId.trim()) {
      errors.collegeId = "Institutional College ID or Roll Number is required.";
    } else if (collegeId.trim().length < 3) {
      errors.collegeId = "College ID must be at least 3 characters.";
    }

    if (!fullName.trim()) {
      errors.fullName = "Full name is required as recorded on the college roster.";
    } else if (fullName.trim().length < 2) {
      errors.fullName = "Full name must be at least 2 characters.";
    }

    if (!email.trim()) {
      errors.email = "Institutional student email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address (e.g., student@college.edu).";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 12) {
      errors.password = "Security requirement: Password must be at least 12 characters.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Confirm password is required.";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
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
      const user = await registerStudentUser({
        college_id: collegeId.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
        password,
      });

      setRegisteredUser(user);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during student registration.";
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
              STUDENT VOTER REGISTRATION
            </span>
          </div>
        </div>

        <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-slate-900">
          Activate Voter Account
        </h1>
        <p className="mt-1 text-center text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
          Verify your enrollment against the official eligibility roster to create your secret ballot credentials.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
          {/* Registration Success State */}
          {registeredUser ? (
            <div className="space-y-5 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold shadow-2xs">
                ✓
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Registration Complete!
                </h2>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Your student record has been verified. Account for{" "}
                  <strong className="text-slate-900">{registeredUser.full_name}</strong> (
                  <span className="font-mono text-slate-700">{registeredUser.email}</span>) is now active.
                </p>
              </div>

              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 text-left space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Eligibility Status: Verified & Claimed
                </div>
                <div className="text-[11px] text-emerald-700">
                  You are registered as an authorized voter. You can now sign in to view open elections and submit secret ballots.
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => router.push("/student/login")}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-purple-700 hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-600 transition-colors cursor-pointer"
                >
                  Proceed to Student Sign In →
                </button>

                <Link
                  href="/"
                  className="w-full block py-2 px-4 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                >
                  ← Return to Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Error Alert */}
              {errorMessage && (
                <div
                  className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3"
                  role="alert"
                >
                  <span className="text-rose-600 text-lg leading-none" aria-hidden="true">
                    ✕
                  </span>
                  <div className="text-xs text-rose-800 flex-1 leading-relaxed">
                    <strong className="block font-semibold mb-0.5">Verification Failed</strong>
                    {errorMessage}
                    {errorMessage.includes("already been registered") && (
                      <div className="mt-2 pt-2 border-t border-rose-200">
                        <Link
                          href="/student/login"
                          className="font-semibold text-purple-700 hover:text-purple-900 underline inline-flex items-center gap-1"
                        >
                          Sign in with existing credentials →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Roster Match Advisory */}
              <div className="mb-5 p-3 rounded-xl bg-purple-50/70 border border-purple-100 text-xs text-purple-900">
                <div className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider text-purple-800 mb-0.5">
                  <span aria-hidden="true">ℹ️</span> Identity Matching Notice
                </div>
                <p className="text-[11px] text-purple-800/90 leading-relaxed">
                  Your <strong>College ID</strong> and <strong>Full Name</strong> must exactly match the institutional roster uploaded by the election administration.
                </p>
              </div>

              {/* Form */}
              <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                {/* College ID */}
                <div>
                  <label
                    htmlFor="college-id"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Institutional College ID / Roll Number
                  </label>
                  <div className="mt-1">
                    <input
                      id="college-id"
                      name="college_id"
                      type="text"
                      required
                      value={collegeId}
                      onChange={(e) => {
                        setCollegeId(e.target.value);
                        if (validationErrors.collegeId) {
                          setValidationErrors((prev) => ({ ...prev, collegeId: undefined }));
                        }
                      }}
                      placeholder="e.g. STU-2024-001"
                      className={`block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-colors ${
                        validationErrors.collegeId
                          ? "border-rose-400 bg-rose-50/20"
                          : "border-slate-300"
                      }`}
                    />
                    {validationErrors.collegeId && (
                      <p className="mt-1 text-xs text-rose-600">{validationErrors.collegeId}</p>
                    )}
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label
                    htmlFor="full-name"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Official Full Name
                  </label>
                  <div className="mt-1">
                    <input
                      id="full-name"
                      name="full_name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (validationErrors.fullName) {
                          setValidationErrors((prev) => ({ ...prev, fullName: undefined }));
                        }
                      }}
                      placeholder="e.g. Sreya S"
                      className={`block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-colors ${
                        validationErrors.fullName
                          ? "border-rose-400 bg-rose-50/20"
                          : "border-slate-300"
                      }`}
                    />
                    {validationErrors.fullName && (
                      <p className="mt-1 text-xs text-rose-600">{validationErrors.fullName}</p>
                    )}
                  </div>
                </div>

                {/* Institutional Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Institutional Student Email
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
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
                    />
                    {validationErrors.email && (
                      <p className="mt-1 text-xs text-rose-600">{validationErrors.email}</p>
                    )}
                  </div>
                </div>

                {/* Password (12+ characters requirement) */}
                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                    >
                      Password
                    </label>
                    <span className="text-[10px] text-purple-700 font-semibold">
                      Min 12 characters
                    </span>
                  </div>
                  <div className="mt-1 relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
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
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-medium text-slate-500 hover:text-slate-800"
                      tabIndex={-1}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {validationErrors.password && (
                    <p className="mt-1 text-xs text-rose-600">{validationErrors.password}</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Confirm Password
                  </label>
                  <div className="mt-1">
                    <input
                      id="confirm-password"
                      name="confirm_password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (validationErrors.confirmPassword) {
                          setValidationErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                        }
                      }}
                      placeholder="••••••••••••"
                      className={`block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-colors ${
                        validationErrors.confirmPassword
                          ? "border-rose-400 bg-rose-50/20"
                          : "border-slate-300"
                      }`}
                    />
                    {validationErrors.confirmPassword && (
                      <p className="mt-1 text-xs text-rose-600">{validationErrors.confirmPassword}</p>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
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
                        Verifying with Eligibility Roster...
                      </span>
                    ) : (
                      "Claim Record & Register"
                    )}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Navigation Links */}
          <div className="mt-6 pt-5 border-t border-slate-100 space-y-2 text-xs text-center">
            <div>
              <span className="text-slate-500">Already registered? </span>
              <Link
                href="/student/login"
                className="font-semibold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1"
              >
                Sign in to Student Portal →
              </Link>
            </div>

            <div className="flex items-center justify-center gap-3 text-slate-400 pt-1">
              <Link href="/" className="hover:text-slate-700 transition-colors">
                ← Dashboard
              </Link>
              <span>•</span>
              <Link href="/login" className="hover:text-purple-700 transition-colors">
                Admin Sign In
              </Link>
            </div>
          </div>
        </div>

        {/* Security & Cryptographic Privacy Footer */}
        <div className="mt-6 p-4 rounded-xl bg-slate-100/80 border border-slate-200 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-800 mb-1">
            <span aria-hidden="true">🔒</span> Roster Protection Protocol
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Eligible student records are protected by database row-level locking during registration to prevent duplicate claims. Each verified student receives exactly one confidential ballot allocation.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function StudentRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f6f7fb] flex items-center justify-center">
          <div className="text-sm text-slate-600 flex items-center gap-2">
            <span className="animate-spin text-purple-600 font-bold">↻</span>
            Loading student registration portal...
          </div>
        </div>
      }
    >
      <StudentRegisterForm />
    </Suspense>
  );
}

