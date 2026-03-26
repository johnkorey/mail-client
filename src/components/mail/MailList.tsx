import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Message } from "../../types/graph";
import { formatMailDate, getSenderName } from "../../utils/formatters";

interface MailListProps {
  messages: Message[];
  selectedId: string | null;
  isLoading: boolean;
  folderName: string;
  onSelectMessage: (id: string) => void;
  onLoadMore?: () => void;
}

export function MailList({
  messages,
  selectedId,
  isLoading,
  folderName,
  onSelectMessage,
}: MailListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 76,
    overscan: 10,
  });

  if (isLoading) {
    return (
      <div className="mail-list-panel">
        <div className="mail-list-header">
          <h2>{folderName}</h2>
        </div>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="mail-list-panel">
        <div className="mail-list-header">
          <h2>{folderName}</h2>
        </div>
        <div className="empty-state">
          <div className="icon">📭</div>
          <p>No messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mail-list-panel">
      <div className="mail-list-header">
        <h2>{folderName}</h2>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          {messages.length} messages
        </span>
      </div>
      <div className="mail-list-scroll" ref={parentRef}>
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const msg = messages[virtualRow.index];
            const isActive = msg.id === selectedId;
            const isUnread = !msg.isRead;

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className={`mail-item ${isActive ? "active" : ""} ${isUnread ? "unread" : ""}`}
                  onClick={() => msg.id && onSelectMessage(msg.id)}
                >
                  <div className="mail-item-content">
                    <div className="mail-item-header">
                      <span className="mail-item-sender">
                        {getSenderName(msg.from)}
                      </span>
                      <div className="mail-item-indicators">
                        {msg.hasAttachments && <span className="icon">📎</span>}
                        {msg.importance === "high" && (
                          <span className="icon" style={{ color: "var(--color-danger)" }}>❗</span>
                        )}
                        {msg.flag?.flagStatus === "flagged" && (
                          <span className="icon" style={{ color: "var(--color-flag)" }}>🚩</span>
                        )}
                        <span className="mail-item-date">
                          {formatMailDate(msg.receivedDateTime)}
                        </span>
                      </div>
                    </div>
                    <div className="mail-item-subject">
                      {msg.subject || "(No subject)"}
                    </div>
                    <div className="mail-item-preview">
                      {msg.bodyPreview || ""}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
