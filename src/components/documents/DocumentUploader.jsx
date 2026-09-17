import { useRef, useState } from "react";
import { uploadDocument } from "../../api/documentsApi";
import { FormModal, Field } from "../ui";

const ACCEPTED = ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp";
const MAX_BYTES = 50 * 1024 * 1024;

/** Upload modal (DR-019): the page's "Upload" button opens this. */
export default function DocumentUploader({ onUploaded, onClose }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [agentWork, setAgentWork] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [fileError, setFileError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (f.size > MAX_BYTES) { setFileError("File exceeds the 50 MB limit."); return; }
    setFileError(null);
    setFile(f);
    setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  // A failed upload throws: FormModal keeps the modal open and shows the message.
  const handleSubmit = async () => {
    if (!file) return false;
    const tags = agentWork
      ? ["agent", ...(agentName.trim() ? [`agent:${agentName.trim()}`] : [])]
      : [];
    const doc = await uploadDocument(file, { name, description, tags });
    onUploaded(doc);
  };

  return (
    <FormModal
      title="Upload a document"
      submitLabel="Upload"
      submitDisabled={!file || !name.trim()}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <button
        type="button"
        className={`doc-dropzone ${dragOver ? "dragover" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
        data-autofocus
      >
        <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" />
        <span>{file ? file.name : "Drop a file here or click to browse"}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        hidden
        onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
      />
      {fileError && <p className="doc-upload-error" role="alert">{fileError}</p>}
      {file && (
        <>
          <Field label="Display name">
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Description" hint="Optional.">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
          <label className="checkbox-inline">
            <input type="checkbox" checked={agentWork} onChange={(e) => setAgentWork(e.target.checked)} />
            <span><i className="fa-solid fa-robot" aria-hidden="true" /> This is agent work (show under “Agent work”)</span>
          </label>
          {agentWork && (
            <Field label="Agent name" hint="Optional, e.g. Aulë.">
              <input value={agentName} onChange={(e) => setAgentName(e.target.value)} />
            </Field>
          )}
        </>
      )}
    </FormModal>
  );
}
