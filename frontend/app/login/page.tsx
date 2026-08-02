"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE, migrateGuestData } from "@/lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMigrationStatus(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        const token = data.token;
        localStorage.setItem("authToken", token); // Save the "Golden Ticket"

        // Migrate any guest data to the authenticated account
        const guestData = localStorage.getItem("guestResources");
        if (guestData && JSON.parse(guestData).length > 0) {
          setMigrationStatus("Syncing your guest data...");
          const count = await migrateGuestData(token);
          setMigrationStatus(`Synced ${count} resource${count !== 1 ? "s" : ""}!`);
          // Brief pause so the user sees the sync message
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        router.push("/"); // Redirect to Command Center
      } else {
        setError("Access denied. Check your credentials and try again.");
      }
    } catch (err) {
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-[#a1a1aa] font-sans antialiased flex items-center justify-center relative overflow-hidden">

      {/* Same ambient glow treatment as the Command Center */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-900/20 rounded-full blur-[120px] pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="text-center mb-10">
          <div className="text-white font-bold text-2xl tracking-tighter mb-6">
            CC<span className="text-blue-500">.</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white leading-tight drop-shadow-lg mb-3">
            ACCESS
          </h1>
          <div className="flex items-center justify-center gap-3 text-zinc-500 text-[10px] tracking-[0.25em] uppercase font-semibold">
            <div className="h-[1px] w-8 bg-white/20"></div>
            <span>Authentication Required</span>
            <div className="h-[1px] w-8 bg-white/20"></div>
          </div>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-xl space-y-5"
        >
          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2 block">
              Username
            </label>
            <Input
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="bg-white/5 backdrop-blur-xl border-white/10 text-white placeholder:text-zinc-500 rounded-xl focus-visible:ring-1 focus-visible:ring-blue-500 h-12 px-5 shadow-lg"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2 block">
              Password
            </label>
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-white/5 backdrop-blur-xl border-white/10 text-white placeholder:text-zinc-500 rounded-xl focus-visible:ring-1 focus-visible:ring-blue-500 h-12 px-5 shadow-lg"
            />
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {migrationStatus && (
            <div className="text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 flex items-center gap-2">
              <svg className="animate-spin h-3 w-3 text-blue-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              {migrationStatus}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600/90 text-white hover:bg-blue-600 rounded-xl h-12 font-semibold shadow-md transition-all disabled:opacity-50"
          >
            {isLoading ? "Verifying..." : "Login"}
          </Button>
        </form>

        <p className="text-center text-zinc-500 text-xs mt-6">
          Don&apos;t have an account?{" "}
          <button
            onClick={() => router.push("/register")}
            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
          >
            Create one
          </button>
        </p>

        <p className="text-center text-zinc-600 text-[10px] tracking-widest uppercase mt-6">
          Command Center · Restricted System
        </p>
      </div>
    </main>
  );
}