import { useSearchParams } from "react-router-dom";
import PageTabs from "../../components/PageTabs";
import SnippetsPage from "./SnippetsPage";
import DocumentsPage from "./DocumentsPage";
import StoragePage from "./StoragePage";
import HikerPage from "./HikerPage";

/**
 * VAULT — things you store: Secrets (passwords/keys/snippets), Documents,
 * Files (storage buckets), Databases (the SJHC member DB). Answers: "where did
 * I put it?" (AI Context moved to Mission Control -> Brain -> Memory, where it
 * belongs — it's the agents' memory, not a stored secret.)
 */
const TABS = [
  { key: "secrets",   label: "Secrets",   icon: "fa-key" },
  { key: "documents", label: "Documents", icon: "fa-file-lines" },
  { key: "files",     label: "Files",     icon: "fa-database" },
  { key: "databases", label: "Databases", icon: "fa-table-list" },
];

export default function VaultPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get("tab")) ? params.get("tab") : "secrets";
  const setTab = (key) => setParams(key === "secrets" ? {} : { tab: key }, { replace: true });

  return (
    <div className="combined-page">
      <div className="combined-page-header">
        <h1 className="combined-page-title">
          <i className="fa-solid fa-vault" /> Vault
        </h1>
        <PageTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="combined-embed">
        {tab === "secrets"   && <SnippetsPage />}
        {tab === "documents" && <DocumentsPage />}
        {tab === "files"     && <StoragePage />}
        {tab === "databases" && <HikerPage />}
      </div>
    </div>
  );
}
