import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login, loginWithGoogle, getSession } from "../../api/plannerApi";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getSession().then((session) => {
      if (session) navigate("/admin/dashboard", { replace: true });
    });
  }, [navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login("scottadamsx@gmail.com", password);
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h2>
          <span className="gradient-text">Admin</span> Login
        </h2>
        <p>Your personal command centre.</p>

        <button type="button" className="google-btn" onClick={async () => { try { await loginWithGoogle(); } catch (err) { setError(err?.message || "Google sign-in failed."); } }}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
          Continue with Google
        </button>

        <div className="auth-divider"><span>or</span></div>

        <form onSubmit={submit}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="btn" disabled={loading} style={{ width: "100%", marginTop: "0.5rem" }}>
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <Link to="/" className="auth-back">
          <i className="fa-solid fa-arrow-left" /> Back to heyScottyBro
        </Link>
      </div>
    </div>
  );
}
