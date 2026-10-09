"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { api } from "@/lib/api";
import { Loader2, MessageSquare, ArrowRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthStep = "phone" | "otp" | "profile";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, setAuth, checkAuth } = useAuthStore();
  
  const [step, setStep] = useState<AuthStep>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Check auth and redirect if logged in
  useEffect(() => {
    checkAuth().then(() => {
      if (useAuthStore.getState().isAuthenticated) {
        router.push("/chat");
      }
    });
  }, [checkAuth, router, isAuthenticated]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 5) return;
    setIsLoading(true);
    setError("");
    try {
      await api.post("/auth/request-otp", { phone });
      setStep("otp");
    } catch (err: any) {
      setError(err.message || "Failed to send code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 4) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/verify-otp", { phone, code: otp });
      setAuth(res.token, res.user);
      if (res.is_new_user) {
        setStep("profile");
      } else {
        router.push("/chat");
      }
    } catch (err: any) {
      setError(err.message || "Invalid code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    setError("");
    try {
      const updatedUser = await api.patch("/users/me", { display_name: name, about });
      useAuthStore.getState().setUser(updatedUser);
      router.push("/chat");
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthenticated && step !== "profile") {
    return <div className="h-screen bg-signal-dark flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-signal-blue animate-spin" />
    </div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#111111] to-[#0a0a0a] flex items-center justify-center p-4">
      {/* Decorative background blurs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-signal-blue/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-white/5 border border-white/10 backdrop-blur-xl p-8 rounded-2xl shadow-2xl z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-signal-blue to-blue-400 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-signal-blue/20">
            <MessageSquare className="w-8 h-8 text-white fill-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            {step === "phone" && "Welcome to Signal"}
            {step === "otp" && "Verify Your Number"}
            {step === "profile" && "Set Up Profile"}
          </h1>
          <p className="text-gray-400 text-center text-sm px-4">
            {step === "phone" && "Privacy that fits in your pocket."}
            {step === "otp" && `We've sent a code to ${phone}. (Hint: 123456)`}
            {step === "profile" && "Your profile is end-to-end encrypted."}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {step === "phone" && (
          <form onSubmit={handlePhoneSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
              <input
                type="tel"
                placeholder="+1 555 000 0001 (Demo: Aarav)"
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-signal-blue focus:border-transparent text-white transition-all placeholder:text-gray-600"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
              />
            </div>
            <button
              disabled={isLoading || phone.length < 5}
              className="w-full py-3 px-4 bg-signal-blue hover:bg-blue-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:bg-signal-blue text-white font-medium rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-signal-blue/20"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <><span>Continue</span> <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
            <div className="flex items-center justify-center space-x-2 text-gray-500 text-xs mt-6">
              <ShieldCheck className="w-4 h-4" />
              <span>End-to-end encrypted</span>
            </div>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleOtpSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Confirmation Code</label>
              <input
                type="text"
                placeholder="123456"
                className="w-full px-4 py-3 text-center tracking-[0.5em] font-mono text-xl bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-signal-blue focus:border-transparent text-white transition-all"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                autoFocus
              />
            </div>
            <button
              disabled={isLoading || otp.length < 4}
              className="w-full py-3 px-4 bg-signal-blue hover:bg-blue-600 active:scale-[0.98] transition-all disabled:opacity-50 text-white font-medium rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-signal-blue/20"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Verify</span>}
            </button>
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="w-full text-center text-sm text-gray-400 hover:text-white transition-colors"
            >
              Wrong number?
            </button>
          </form>
        )}

        {step === "profile" && (
          <form onSubmit={handleProfileSubmit} className="space-y-6">
             <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
              <input
                type="text"
                placeholder="Required"
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-signal-blue focus:border-transparent text-white transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">About</label>
              <input
                type="text"
                placeholder="Write something about yourself"
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-signal-blue focus:border-transparent text-white transition-all"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
              />
            </div>
            <button
              disabled={isLoading || !name.trim()}
              className="w-full py-3 px-4 bg-signal-blue hover:bg-blue-600 active:scale-[0.98] transition-all disabled:opacity-50 text-white font-medium rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-signal-blue/20"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Finish Setup</span>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
