import { useSearchParams } from "react-router-dom";
import PageTabs from "../../components/PageTabs";
import SnippetsPage from "./SnippetsPage";
import ContextPage from "./ContextPage";
import DocumentsPage from "./DocumentsPage";

const TABS = [
  { key: "snippets",  label: "Snippets",  icon: "fa-key" },
  { key: "context",   label: "Context",   icon: "fa-brain" },
  { key: "documents", label: "Documents", icon: "fa-file-lines" },
];

export default function VaultPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get("tab")) ? params.get("tab") : "snippets";
  const setTab = (key) => setParams(key === "snippets" ? {} : { tab: key }, { replace: true });

  return (
    <div className="combined-page">
      <div className="combined-page-header">
        <h1 className="combined-page-title">
          <i className="fa-solid fa-vault" /> Vault
        </h1>
        <PageTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="combined-embed">
        {tab === "snippets"  && <SnippetsPage />}
        {tab === "context"   && <ContextPage />}
        {tab === "documents" && <DocumentsPage />}
      </div>
    </div>
  );
}
