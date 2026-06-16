import { Component } from "react";

const PREVIEW_CHARS = 200;

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
      resolve();
    } catch (err) { reject(err); }
  });
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, stack: "", copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
    this.setState({ stack: info?.componentStack || "" });
  }

  reset() {
    this.setState({ hasError: false, error: null, stack: "", copied: false });
  }

  copyFull() {
    const e = this.state.error;
    const full = [
      e?.message || String(e || "Unknown error"),
      e?.stack ? `\n${e.stack}` : "",
      this.state.stack ? `\nComponent stack:${this.state.stack}` : "",
    ].join("");
    copyToClipboard(full)
      .then(() => { this.setState({ copied: true }); setTimeout(() => this.setState({ copied: false }), 1600); })
      .catch(() => {});
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const msg = this.state.error?.message || "Unexpected error.";
    const isLong = msg.length > PREVIEW_CHARS;
    const preview = isLong ? `${msg.slice(0, PREVIEW_CHARS).trimEnd()}…` : msg;

    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p style={{ color: "var(--danger, var(--red))", marginBottom: "0.75rem", fontWeight: 600 }}>
          Something went wrong in this section.
        </p>
        <p style={{
          fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem",
          whiteSpace: "pre-wrap", wordBreak: "break-word", maxWidth: "560px",
          marginLeft: "auto", marginRight: "auto", textAlign: "left",
        }}>
          {preview}
        </p>
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn" onClick={() => this.reset()}>Reload section</button>
          <button
            className="btn"
            style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }}
            onClick={() => this.copyFull()}
          >
            <i className="fa-solid fa-copy" /> {this.state.copied ? "Copied" : "Copy full error"}
          </button>
        </div>
      </div>
    );
  }
}
