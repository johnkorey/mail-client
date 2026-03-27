import { useState, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { useSendMail } from "../../hooks/useGraphQuery";
import { useAuth } from "../../auth/AuthProvider";
import type { ComposeMessage } from "../../types/graph";

export function BulkMessaging() {
  const { microsoftConnected } = useAuth();
  const sendMail = useSendMail();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recipients, setRecipients] = useState("");
  const [subject, setSubject] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0, failed: 0 });
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [sendIndividually, setSendIndividually] = useState(true);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Underline,
      Placeholder.configure({ placeholder: "Write your message..." }),
    ],
    content: "",
  });

  const parseEmails = (input: string): string[] => {
    return input
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes("@"));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSend = useCallback(async () => {
    if (!editor || !subject.trim()) return;

    const emails = parseEmails(recipients);
    if (emails.length === 0) return;

    setSending(true);
    setStatus("sending");
    setProgress({ sent: 0, total: emails.length, failed: 0 });

    const attachments = await Promise.all(
      attachedFiles.map(async (file) => ({
        "@odata.type": "#microsoft.graph.fileAttachment" as const,
        name: file.name,
        contentType: file.type,
        contentBytes: await fileToBase64(file),
      }))
    );

    const htmlContent = editor.getHTML();

    if (sendIndividually) {
      // Send one email per recipient
      let sent = 0;
      let failed = 0;
      for (const email of emails) {
        try {
          const message: ComposeMessage = {
            subject,
            body: { contentType: "html", content: htmlContent },
            toRecipients: [{ emailAddress: { address: email } }],
            attachments: attachments.length > 0 ? attachments : undefined,
          };
          await sendMail.mutateAsync(message);
          sent++;
        } catch {
          failed++;
        }
        setProgress({ sent, total: emails.length, failed });
      }
    } else {
      // Send one email with all recipients in BCC
      try {
        const message: ComposeMessage = {
          subject,
          body: { contentType: "html", content: htmlContent },
          toRecipients: [{ emailAddress: { address: emails[0] } }],
          bccRecipients: emails.slice(1).map((addr) => ({ emailAddress: { address: addr } })),
          attachments: attachments.length > 0 ? attachments : undefined,
        };
        await sendMail.mutateAsync(message);
        setProgress({ sent: emails.length, total: emails.length, failed: 0 });
      } catch {
        setProgress({ sent: 0, total: emails.length, failed: emails.length });
      }
    }

    setSending(false);
    setStatus("done");
  }, [editor, subject, recipients, attachedFiles, sendMail, sendIndividually]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const reset = () => {
    setRecipients("");
    setSubject("");
    setAttachedFiles([]);
    setStatus("idle");
    setProgress({ sent: 0, total: 0, failed: 0 });
    editor?.commands.clearContent();
  };

  if (!microsoftConnected) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
        Connect an Office 365 account to send bulk messages.
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Bulk Messaging</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
          Send a message to multiple recipients at once
        </p>
      </div>

      {status === "done" ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{progress.failed === 0 ? "✅" : "⚠️"}</div>
          <h3 style={{ marginBottom: 8 }}>Bulk Send Complete</h3>
          <p style={{ color: "var(--color-success)", fontWeight: 600 }}>{progress.sent} sent successfully</p>
          {progress.failed > 0 && (
            <p style={{ color: "var(--color-danger)", marginTop: 4 }}>{progress.failed} failed</p>
          )}
          <button className="btn btn-primary" onClick={reset} style={{ marginTop: 20, padding: "8px 24px" }}>
            Send Another
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Recipients */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Recipients
            </label>
            <textarea
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="Enter email addresses separated by commas, semicolons, or new lines..."
              rows={4}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                resize: "vertical",
                fontSize: 13,
              }}
            />
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
              {parseEmails(recipients).length} recipients detected
            </div>
          </div>

          {/* Send mode */}
          <div style={{ display: "flex", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="radio" checked={sendIndividually} onChange={() => setSendIndividually(true)} />
              Send individually (each gets their own email)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="radio" checked={!sendIndividually} onChange={() => setSendIndividually(false)} />
              Send as BCC (one email, others hidden)
            </label>
          </div>

          {/* Subject */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
              }}
            />
          </div>

          {/* Editor */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Message</label>
            <div style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              minHeight: 200,
              overflow: "hidden",
            }}>
              {editor && (
                <div style={{ display: "flex", gap: 2, padding: "6px 8px", borderBottom: "1px solid var(--color-border)", background: "var(--color-bg-secondary)" }}>
                  <button className={`btn-icon ${editor.isActive("bold") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleBold().run()}>
                    <strong>B</strong>
                  </button>
                  <button className={`btn-icon ${editor.isActive("italic") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleItalic().run()}>
                    <em>I</em>
                  </button>
                  <button className={`btn-icon ${editor.isActive("underline") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                    <u>U</u>
                  </button>
                  <button className={`btn-icon ${editor.isActive("bulletList") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                    •≡
                  </button>
                </div>
              )}
              <div style={{ padding: "8px 12px" }}>
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <button className="btn" onClick={() => fileInputRef.current?.click()} style={{ padding: "6px 16px", fontSize: 13 }}>
              📎 Attach Files
            </button>
            <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} style={{ display: "none" }} />
            {attachedFiles.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {attachedFiles.map((file, i) => (
                  <div key={i} className="attachment-chip">
                    <span>📎 {file.name}</span>
                    <button className="btn-icon" onClick={() => setAttachedFiles((p) => p.filter((_, j) => j !== i))} style={{ padding: 0, fontSize: 11 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Send button / Progress */}
          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 16 }}>
            {sending ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                  <span>Sending... {progress.sent} / {progress.total}</span>
                  {progress.failed > 0 && <span style={{ color: "var(--color-danger)" }}>{progress.failed} failed</span>}
                </div>
                <div style={{ height: 6, background: "var(--color-bg-secondary)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${(progress.sent / progress.total) * 100}%`,
                    background: "var(--color-primary)",
                    borderRadius: 3,
                    transition: "width 0.3s",
                  }} />
                </div>
              </div>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleSend}
                disabled={parseEmails(recipients).length === 0 || !subject.trim()}
                style={{ padding: "10px 32px" }}
              >
                Send to {parseEmails(recipients).length} recipients
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
