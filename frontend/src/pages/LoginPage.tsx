import { useState, type ComponentProps } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { AppBrandLockup } from "../components/AppBrand";
import { login } from "../services/api";

type SubmitEvent = Parameters<NonNullable<ComponentProps<"form">["onSubmit"]>>[0];

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Login successful");
      navigate("/", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <AppBrandLockup variant="auth" className="mb-6" />
        <h1 className="mb-1 text-2xl font-semibold">Sign in</h1>
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
          Sign in with your account to continue.
        </p>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="********"
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">
          Don&apos;t have account?{" "}
          <Link to="/signup" className="font-medium text-indigo-600 hover:underline">
            Signup
          </Link>
        </p>
      </div>
    </div>
  );
}

