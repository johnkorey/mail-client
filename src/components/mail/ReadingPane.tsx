import { useEffect, useRef, useCallback } from "react";
import { useMessage, useAttachments, useMarkAsRead } from "../../hooks/useGraphQuery";
import { sanitizeEmailHtml } from "../../utils/sanitize";
import {
  formatFullDate,
  getSenderName,
  getSenderEmail,
  formatFileSize,
} from "../../utils/formatters";

interface ReadingPaneProps {
  messageId: string | null;
  onReply: (messageId: string) => void;
  onReplyAll: (messageId: string) => void;
  onForward: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onBack?: () => void;
}

export function ReadingPane({
  messageId,
  onReply,
  onReplyAll,
  onForward,
  onDelete,
  onBack,
}: ReadingPaneProps) {
  const { data: message, isLoading } = useMessage(messageId);
  const { data: attachments } = useAttachments(
    message?.hasAttachments ? messageId : null
  );
  const markAsRead = useMarkAsRead();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-mark as read
  useEffect(() => {
    if (message && !message.isRead && message.id) {
      markAsRead.mutate({ messageId: message.id, isRead: true });
    }
  }, [message?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize iframe to content height
  const adjustIframeHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (doc?.body) {
        iframe.style.height = doc.body.scrollHeight + 40 + "px";
      }
    } catch {
      // cross-origin, ignore
    }
  }, []);

  if (!messageId) {
    return (
      <div className="reading-pane">
        <div className="reading-pane-empty">
          Select a message to read
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="reading-pane">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="reading-pane">
        <div className="reading-pane-empty">Message not found</div>
      </div>
    );
  }

  const htmlContent = message.body?.contentType === "html"
    ? sanitizeEmailHtml(message.body.content || "")
    : `<pre style="font-family: inherit; white-space: pre-wrap;">${message.body?.content || ""}</pre>`;

  const recipients = message.toRecipients
    ?.map((r) => r.emailAddress?.name || r.emailAddress?.address)
    .join(", ");

  const ccRecipients = message.ccRecipients
    ?.map((r) => r.emailAddress?.name || r.emailAddress?.address)
    .join(", ");

  return (
    <div className="reading-pane">
      {/* Header */}
      <div className="reading-pane-header">
        {onBack && (
          <button className="btn-icon" onClick={onBack} style={{ marginBottom: 8 }}>
            ← Back
          </button>
        )}
        <div className="reading-pane-subject">
          {message.importance === "high" && (
            <span style={{ color: "var(--color-danger)", marginRight: 8 }}>❗</span>
          )}
          {message.subject || "(No subject)"}
        </div>
        <div className="reading-pane-meta">
          <span className="reading-pane-sender">
            {getSenderName(message.from)}
          </span>
          <span>&lt;{getSenderEmail(message.from)}&gt;</span>
          <span>•</span>
          <span>{formatFullDate(message.receivedDateTime)}</span>
        </div>
        {recipients && (
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
            To: {recipients}
          </div>
        )}
        {ccRecipients && (
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Cc: {ccRecipients}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="reading-pane-actions">
        <button className="btn" onClick={() => message.id && onReply(message.id)}>
          ↩️ Reply
        </button>
        <button className="btn" onClick={() => message.id && onReplyAll(message.id)}>
          ↩️ Reply All
        </button>
        <button className="btn" onClick={() => message.id && onForward(message.id)}>
          ↪️ Forward
        </button>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-danger"
          onClick={() => message.id && onDelete(message.id)}
        >
          🗑️ Delete
        </button>
      </div>

      {/* Attachments */}
      {attachments && attachments.length > 0 && (
        <div className="attachment-list">
          {attachments.map((att) => (
            <div key={att.id} className="attachment-chip">
              <span className="icon">📎</span>
              <span>{att.name}</span>
              <span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>
                ({formatFileSize(att.size)})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Body — rendered in sandboxed iframe */}
      <div className="reading-pane-body">
        <iframe
          ref={iframeRef}
          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
          srcDoc={`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8" />
              <meta http-equiv="Content-Security-Policy" content="script-src 'none';" />
              <style>
                body {
                  font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
                  font-size: 14px;
                  color: #1a1a1a;
                  padding: 16px 24px;
                  margin: 0;
                  line-height: 1.5;
                  word-wrap: break-word;
                  overflow-wrap: break-word;
                }
                img { max-width: 100%; height: auto; }
                a { color: #0078d4; }
                pre { white-space: pre-wrap; }
                table { max-width: 100%; }
                blockquote {
                  border-left: 3px solid #ddd;
                  margin: 8px 0;
                  padding-left: 12px;
                  color: #666;
                }
              </style>
            </head>
            <body>${htmlContent}</body>
            </html>
          `}
          onLoad={adjustIframeHeight}
          style={{ width: "100%", border: "none", minHeight: 200 }}
          title="Email content"
        />
      </div>
    </div>
  );
}
