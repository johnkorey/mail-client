import { useState, useCallback } from "react";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleSidebar: () => void;
  onRefresh: () => void;
  onManageAccounts?: () => void;
}

export function Header({
  searchQuery,
  onSearchChange,
  onToggleSidebar,
  onRefresh,
  onManageAccounts,
}: HeaderProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSearchChange(localQuery);
    },
    [localQuery, onSearchChange]
  );

  const handleClear = useCallback(() => {
    setLocalQuery("");
    onSearchChange("");
  }, [onSearchChange]);

  return (
    <div className="app-header">
      <button className="btn-icon" onClick={onToggleSidebar} title="Toggle sidebar">
        ☰
      </button>

      <form onSubmit={handleSubmit} className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search mail..."
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
        />
        {localQuery && (
          <button
            type="button"
            className="btn-icon"
            onClick={handleClear}
            style={{ padding: 2 }}
          >
            ✕
          </button>
        )}
      </form>

      <button className="btn-icon" onClick={onRefresh} title="Refresh">
        🔄
      </button>

      {onManageAccounts && (
        <button className="btn-icon" onClick={onManageAccounts} title="Manage accounts">
          ⚙️
        </button>
      )}
    </div>
  );
}
