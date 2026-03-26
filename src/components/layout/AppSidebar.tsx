import { useAuth } from "../../auth/AuthProvider";
import { useMailFolders } from "../../hooks/useGraphQuery";

interface AppSidebarProps {
  activeFolder: string;
  activeView: string;
  onFolderSelect: (folderId: string) => void;
  onViewChange: (view: string) => void;
  onCompose: () => void;
  isOpen: boolean;
}

const FOLDER_ICONS: Record<string, string> = {
  inbox: "📥",
  drafts: "📝",
  sentitems: "📤",
  deleteditems: "🗑️",
  junkemail: "⚠️",
  archive: "📦",
  outbox: "📮",
};

function getFolderIcon(displayName: string): string {
  const key = displayName.toLowerCase().replace(/\s/g, "");
  return FOLDER_ICONS[key] || "📁";
}

const VIEW_ITEMS = [
  { id: "mail", icon: "✉️", label: "Mail" },
  { id: "calendar", icon: "📅", label: "Calendar" },
  { id: "contacts", icon: "👤", label: "Contacts" },
];

export function AppSidebar({
  activeFolder,
  activeView,
  onFolderSelect,
  onViewChange,
  onCompose,
  isOpen,
}: AppSidebarProps) {
  const { user, microsoftConnected, microsoftAccounts, activeAccountId, setActiveAccountId, logout } = useAuth();
  const { data: folders } = useMailFolders();

  return (
    <div className={`app-sidebar${isOpen ? " open" : ""}`}>
      {/* User info */}
      <div className="sidebar-user">
        <div className="sidebar-user-avatar">
          {user?.displayName?.charAt(0)?.toUpperCase() || "U"}
        </div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.displayName}</div>
          <div className="sidebar-user-email">
            {microsoftConnected && microsoftAccounts.length > 0
              ? microsoftAccounts.find((a) => a.id === activeAccountId)?.username || microsoftAccounts[0].username
              : user?.email}
          </div>
        </div>
      </div>

      {/* New Message button */}
      <div style={{ padding: "12px 16px" }}>
        <button
          className="btn btn-primary"
          onClick={onCompose}
          style={{ width: "100%", justifyContent: "center", gap: 8 }}
        >
          ✏️ New Message
        </button>
      </div>

      {/* View switcher */}
      <div className="sidebar-section-label">Views</div>
      {VIEW_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`folder-item${activeView === item.id ? " active" : ""}`}
          onClick={() => onViewChange(item.id)}
        >
          <span className="folder-icon">{item.icon}</span>
          <span className="folder-name">{item.label}</span>
        </button>
      ))}

      {/* Folders (only when mail view and connected) */}
      {activeView === "mail" && microsoftConnected && folders && (
        <>
          <div className="sidebar-section-label">Folders</div>
          <div className="sidebar-nav">
            {folders.map((folder: any) => (
              <button
                key={folder.id}
                className={`folder-item${activeFolder === folder.id ? " active" : ""}`}
                onClick={() => onFolderSelect(folder.id)}
              >
                <span className="folder-icon">
                  {getFolderIcon(folder.displayName)}
                </span>
                <span className="folder-name">{folder.displayName}</span>
                {folder.unreadItemCount > 0 && (
                  <span className="folder-count">{folder.unreadItemCount}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Accounts section */}
      <div style={{ marginTop: "auto", borderTop: "1px solid var(--color-border)" }}>
        <div className="sidebar-section-label">Accounts</div>

        {microsoftAccounts.map((acct) => (
          <button
            key={acct.id}
            className={`folder-item${activeAccountId === acct.id ? " active" : ""}`}
            onClick={() => setActiveAccountId(acct.id)}
            title={acct.username}
          >
            <span className="folder-icon">📧</span>
            <span className="folder-name" style={{ fontSize: 12 }}>
              {acct.username}
            </span>
          </button>
        ))}

        <button
          className="folder-item"
          onClick={() => onViewChange("accounts")}
        >
          <span className="folder-icon">➕</span>
          <span className="folder-name">Add Account</span>
        </button>

        <button
          className="folder-item"
          onClick={logout}
          style={{ color: "var(--color-text-muted)" }}
        >
          <span className="folder-icon">🚪</span>
          <span className="folder-name">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
