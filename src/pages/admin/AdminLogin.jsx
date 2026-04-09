import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login, getSession } from "../../api/plannerApi";

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
