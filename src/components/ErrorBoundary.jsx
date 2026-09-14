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
      <div className="crash" role="alert">
        <span className="crash-icon" aria-hidden="true"><i className="fa-solid fa-triangle-exclamation" /></span>
        <p className="crash-title">Something went wrong in this section.</p>
        <p className="crash-detail">{preview}</p>
        <div className="crash-actions">
          <button type="button" className="btn" onClick={() => this.reset()}>Reload section</button>
          <button type="button" className="btn btn-secondary-sm" onClick={() => this.copyFull()}>
            <i className="fa-solid fa-copy" aria-hidden="true" /> {this.state.copied ? "Copied" : "Copy full error"}
          </button>
        </div>
      </div>
    );
  }
}
