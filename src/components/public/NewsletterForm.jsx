import { useId, useState } from "react";
import { subscribe, validateEmail } from "../../utils/newsletter";
import "../../styles/public.css";

/**
 * Email sign-up → newsletter_signups (insert-only for the public).
 * Success and "already on the list" look the same to the visitor; any other
 * failure shows the real reason and keeps what they typed (never a fake success).
 */
export default function NewsletterForm({ source = "site", variant = "terminal", heading = "Get the occasional update" }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const v = validateEmail(email);
    if (!v.ok) { setError(v.error); return; }
    setState("sending");
    setError("");
    try {
      // The Supabase client loads on submit, so public pages don't download it up front.
      const { supabase } = await import("../../utils/supabase");
      await subscribe(supabase, v.email, source);
      setState("done");
    } catch (err) {
      setError(err?.message || "Sign-up failed. Please try again.");
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <div className={`pub-news pub-news-${variant} is-done`} role="status">
        <i className="fa-solid fa-circle-check" aria-hidden="true" />
        <div>
          <strong>You&apos;re on the list.</strong>
          <p>Thanks — I&apos;ll only email when there&apos;s something worth sharing.</p>
        </div>
      </div>
    );
  }

  const sending = state === "sending";
  return (
    <form className={`pub-news pub-news-${variant}`} onSubmit={submit} noValidate aria-labelledby={`${id}-h`}>
      <p className="pub-news-title" id={`${id}-h`}>{heading}</p>
      <p className="pub-news-sub">New projects, launches and the odd build note. No spam — ask and I&apos;ll take you off the list.</p>
      <div className="pub-news-row">
        <label className="pub-sr" htmlFor={`${id}-email`}>Email address</label>
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
          disabled={sending}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          required
        />
        <button type="submit" disabled={sending} aria-busy={sending || undefined}>
          {sending ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Sending…</> : "Sign up"}
        </button>
      </div>
      {error && <p className="pub-news-error" id={`${id}-err`} role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {error}</p>}
    </form>
  );
}
