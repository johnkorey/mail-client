import { useState } from "react";
import { useMessages } from "../../hooks/useGraphQuery";
import { useAuth } from "../../auth/AuthProvider";

interface ExtractedContact {
  name: string;
  email: string;
  source: string;
  count: number;
}

export function ContactExtractor() {
  const { microsoftConnected } = useAuth();
  const { data: messagesData } = useMessages("inbox", 200, 0);
  const [extracted, setExtracted] = useState<ExtractedContact[]>([]);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const handleExtract = () => {
    const messages = messagesData?.value || [];
    const contactMap = new Map<string, ExtractedContact>();

    for (const msg of messages) {
      // From
      const fromAddr = msg.from?.emailAddress?.address?.toLowerCase();
      const fromName = msg.from?.emailAddress?.name || fromAddr || "";
      if (fromAddr) {
        const existing = contactMap.get(fromAddr);
        if (existing) {
          existing.count++;
        } else {
          contactMap.set(fromAddr, { name: fromName, email: fromAddr, source: "From", count: 1 });
        }
      }

      // To recipients
      for (const r of msg.toRecipients || []) {
        const addr = r.emailAddress?.address?.toLowerCase();
        const name = r.emailAddress?.name || addr || "";
        if (addr) {
          const existing = contactMap.get(addr);
          if (existing) {
            existing.count++;
          } else {
            contactMap.set(addr, { name, email: addr, source: "To", count: 1 });
          }
        }
      }

      // CC recipients
      for (const r of (msg as any).ccRecipients || []) {
        const addr = r.emailAddress?.address?.toLowerCase();
        const name = r.emailAddress?.name || addr || "";
        if (addr) {
          const existing = contactMap.get(addr);
          if (existing) {
            existing.count++;
          } else {
            contactMap.set(addr, { name, email: addr, source: "Cc", count: 1 });
          }
        }
      }
    }

    const sorted = Array.from(contactMap.values()).sort((a, b) => b.count - a.count);
    setExtracted(sorted);
    setHasExtracted(true);
  };

  const toggleSelect = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedEmails.size === extracted.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(extracted.map((c) => c.email)));
    }
  };

  const copySelected = () => {
    const emails = extracted
      .filter((c) => selectedEmails.has(c.email))
      .map((c) => c.email)
      .join(", ");
    navigator.clipboard.writeText(emails);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!microsoftConnected) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
        Connect an Office 365 account to extract contacts from your emails.
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Contact Extraction</h2>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
            Extract email addresses from your inbox messages
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleExtract} style={{ padding: "8px 20px" }}>
          {hasExtracted ? "Re-extract" : "Extract Contacts"}
        </button>
      </div>

      {!hasExtracted ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "var(--color-text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📇</div>
          <p>Click "Extract Contacts" to scan your inbox</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Extracts from senders, recipients, and CC fields</p>
        </div>
      ) : (
        <>
          {/* Actions bar */}
          <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 12, background: "var(--color-bg-secondary)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={selectedEmails.size === extracted.length && extracted.length > 0} onChange={selectAll} />
              Select all ({extracted.length})
            </label>
            {selectedEmails.size > 0 && (
              <>
                <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
                  {selectedEmails.size} selected
                </span>
                <button className="btn" onClick={copySelected} style={{ padding: "4px 14px", fontSize: 12 }}>
                  {copied ? "Copied!" : "Copy Emails"}
                </button>
              </>
            )}
          </div>

          {/* Contact list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {extracted.map((contact) => (
              <div
                key={contact.email}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 20px",
                  borderBottom: "1px solid var(--color-border)",
                  background: selectedEmails.has(contact.email) ? "var(--color-bg-active)" : "transparent",
                  cursor: "pointer",
                }}
                onClick={() => toggleSelect(contact.email)}
              >
                <input
                  type="checkbox"
                  checked={selectedEmails.has(contact.email)}
                  onChange={() => toggleSelect(contact.email)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "var(--color-primary)", color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 600, fontSize: 12, flexShrink: 0,
                }}>
                  {contact.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {contact.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {contact.email}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", textAlign: "right", flexShrink: 0 }}>
                  <div>{contact.count} msgs</div>
                  <div>{contact.source}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
