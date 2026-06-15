import { useRef, useState } from "react";
import { uploadDocument } from "../../api/documentsApi";

const ACCEPTED = ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp";
const MAX_BYTES = 50 * 1024 * 1024;

export default function DocumentUploader({ onUploaded, onClose }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (f.size > MAX_BYTES) { setError("File exceeds the 50 MB limit."); return; }
    setError(null);
    setFile(f);
    setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const doc = await uploadDocument(file, { name, description });
      onUploaded(doc);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="form-card" style={{ maxWidth: 560 }}>
      <div
        className={`doc-dropzone ${dragOver ? "dragover" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
      >
        <i className="fa-solid fa-cloud-arrow-up" />
        <span>{file ? file.name : "Drop a file here or click to browse"}</span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          style={{ display: "none" }}
          onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
        />
      </div>
      {file && (
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <input
              className="field-grow"
              placeholder="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={{ resize: "vertical" }}
          />
          <div className="form-row">
            <button className="btn" type="submit" disabled={uploading}>
              {uploading ? <><i className="fa-solid fa-spinner fa-spin" /> Uploading…</> : "Upload"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      )}
      {error && <p className="no-entries" style={{ color: "var(--danger, var(--red))" }}>{error}</p>}
    </div>
  );
}
