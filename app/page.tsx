"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dices, Shield, Sparkles, User, Lock, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";

export default function AuthPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Form states
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if already authenticated
  useEffect(() => {
    let isMounted = true;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data?.user && isMounted) {
            router.replace("/lobby");
            return;
          }
        }
        if (isMounted) setCheckingAuth(false);
      })
      .catch(() => {
        if (isMounted) setCheckingAuth(false);
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (activeTab === "login") {
      if (!username.trim() || !password) {
        setError("Please provide both username and password.");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim(), password }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data?.error || "Login failed. Please verify your credentials.");
          setLoading(false);
          return;
        }

        router.push("/lobby");
        router.refresh();
      } catch {
        setError("A network error occurred. Please try again.");
        setLoading(false);
      }
    } else {
      // Register
      if (!name.trim()) {
        setError("Character or player name is required.");
        return;
      }
      if (!username.trim()) {
        setError("Username is required.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            username: username.trim(),
            password,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data?.error || "Registration failed. Username may already exist.");
          setLoading(false);
          return;
        }

        router.push("/lobby");
        router.refresh();
      } catch {
        setError("A network error occurred. Please try again.");
        setLoading(false);
      }
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Dices className="h-10 w-10 text-amber-500 animate-spin" />
          <p className="text-sm font-medium text-amber-200/70 font-mono tracking-wide">
            Consulting the ancient scrolls...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Subtle background ambient lights */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-600/10 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[400px] h-[250px] bg-red-600/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* Header Badge */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs font-medium mb-4 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Real-Time Polyhedral Tabletop Room</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-amber-100 tracking-tight">
              Enter the Realm
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              Roll 3D dice in real-time sync with your party members.
            </p>
          </div>

          {/* Card Container */}
          <div className="rounded-2xl border border-amber-900/30 bg-neutral-900/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl ring-1 ring-white/5">
            {/* Tab switch */}
            <div className="grid grid-cols-2 p-1 mb-6 rounded-xl bg-neutral-950/70 border border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("login");
                  setError(null);
                }}
                className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                  activeTab === "login"
                    ? "bg-amber-600 text-neutral-950 shadow-md shadow-amber-600/30"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("register");
                  setError(null);
                }}
                className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                  activeTab === "register"
                    ? "bg-amber-600 text-neutral-950 shadow-md shadow-amber-600/30"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                New Adventurer
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/40 p-3.5 text-red-200 text-xs sm:text-sm">
                <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {activeTab === "register" && (
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Adventurer Name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-500">
                      <Shield className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Torvald Ironbreaker"
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 pl-9 pr-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-500">
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. torvald22"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 pl-9 pr-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-500">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 pl-9 pr-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                  />
                </div>
              </div>

              {activeTab === "register" && (
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-500">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 pl-9 pr-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 px-4 py-3 font-semibold text-neutral-950 shadow-lg shadow-amber-600/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {activeTab === "login"
                        ? "Enter Tavern"
                        : "Forge Character"}
                    </span>
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
