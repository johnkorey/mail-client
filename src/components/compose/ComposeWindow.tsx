import { useState, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { useSendMail } from "../../hooks/useGraphQuery";
import type { ComposeMessage, Recipient } from "../../types/graph";

interface ComposeWindowProps {
  mode: "new" | "reply" | "replyAll" | "forward";
  replyToMessage?: {
    id?: string;
    subject?: string;
    from?: { emailAddress?: { name?: string; address?: string } };
    toRecipients?: Recipient[];
    body?: { content?: string; contentType?: string };
  } | null;
  onClose: () => void;
}

export function ComposeWindow({ mode, replyToMessage, onClose }: ComposeWindowProps) {
  const sendMail = useSendMail();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill based on mode
  const getInitialTo = (): string => {
    if (mode === "reply" || mode === "replyAll") {
      return replyToMessage?.from?.emailAddress?.address || "";
    }
    return "";
  };

  const getInitialCc = (): string => {
    if (mode === "replyAll") {
      return (
        replyToMessage?.toRecipients
          ?.map((r) => r.emailAddress?.address)
          .filter(Boolean)
          .join(", ") || ""
      );
    }
    return "";
  };

  const getInitialSubject = (): string => {
    const subj = replyToMessage?.subject || "";
    if (mode === "reply" || mode === "replyAll") {
      return subj.startsWith("Re:") ? subj : `Re: ${subj}`;
    }
    if (mode === "forward") {
      return subj.startsWith("Fw:") ? subj : `Fw: ${subj}`;
    }
    return "";
  };

  const [to, setTo] = useState(getInitialTo());
  const [cc, setCc] = useState(getInitialCc());
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(getInitialSubject());
  const [showCcBcc, setShowCcBcc] = useState(!!getInitialCc());
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Write your message..." }),
    ],
    content:
      mode !== "new" && replyToMessage?.body?.content
        ? `<br/><br/><hr/><blockquote>${replyToMessage.body.content}</blockquote>`
        : "",
  });

  const parseRecipients = (input: string): Recipient[] => {
    return input
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((addr) => ({
        emailAddress: { address: addr },
      }));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSend = useCallback(async () => {
    if (!to.trim() || !editor) return;

    setSending(true);
    try {
      const attachments = await Promise.all(
        attachedFiles.map(async (file) => ({
          "@odata.type": "#microsoft.graph.fileAttachment" as const,
          name: file.name,
          contentType: file.type,
          contentBytes: await fileToBase64(file),
        }))
      );

      const message: ComposeMessage = {
        subject,
        body: {
          contentType: "html",
          content: editor.getHTML(),
        },
        toRecipients: parseRecipients(to),
        ccRecipients: cc ? parseRecipients(cc) : undefined,
        bccRecipients: bcc ? parseRecipients(bcc) : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      await sendMail.mutateAsync(message);
      onClose();
    } catch (error) {
      console.error("Failed to send:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  }, [to, cc, bcc, subject, editor, attachedFiles, sendMail, onClose]);

  const handleAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const modeTitle =
    mode === "reply"
      ? "Reply"
      : mode === "replyAll"
        ? "Reply All"
        : mode === "forward"
          ? "Forward"
          : "New Message";

  return (
    <div className="compose-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="compose-window">
        <div className="compose-header">
          <h3>{modeTitle}</h3>
          <button
            className="btn-icon"
            onClick={onClose}
            style={{ color: "white" }}
          >
            ✕
          </button>
        </div>

        <div className="compose-fields">
          <div className="compose-field">
            <label>To</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Recipients (comma-separated)"
            />
            {!showCcBcc && (
              <button
                className="btn-icon"
                onClick={() => setShowCcBcc(true)}
                style={{ fontSize: 11 }}
              >
                Cc/Bcc
              </button>
            )}
          </div>
          {showCcBcc && (
            <>
              <div className="compose-field">
                <label>Cc</label>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="Cc recipients"
                />
              </div>
              <div className="compose-field">
                <label>Bcc</label>
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="Bcc recipients"
                />
              </div>
            </>
          )}
          <div className="compose-field">
            <label>Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
          </div>
        </div>

        {/* Formatting toolbar */}
        {editor && (
          <div className="compose-toolbar">
            <button
              className={`btn-icon ${editor.isActive("bold") ? "active" : ""}`}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Bold"
            >
              <strong>B</strong>
            </button>
            <button
              className={`btn-icon ${editor.isActive("italic") ? "active" : ""}`}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Italic"
            >
              <em>I</em>
            </button>
            <button
              className={`btn-icon ${editor.isActive("underline") ? "active" : ""}`}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title="Underline"
            >
              <u>U</u>
            </button>
            <span style={{ width: 1, height: 20, background: "var(--color-border)", margin: "0 4px" }} />
            <button
              className={`btn-icon ${editor.isActive("bulletList") ? "active" : ""}`}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Bullet list"
            >
              •≡
            </button>
            <button
              className={`btn-icon ${editor.isActive("orderedList") ? "active" : ""}`}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Numbered list"
            >
              1.
            </button>
            <span style={{ width: 1, height: 20, background: "var(--color-border)", margin: "0 4px" }} />
            <button
              className={`btn-icon ${editor.isActive("blockquote") ? "active" : ""}`}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title="Blockquote"
            >
              "
            </button>
            <button
              className="btn-icon"
              onClick={() => {
                const url = window.prompt("Enter link URL:");
                if (url) {
                  editor.chain().focus().setLink({ href: url }).run();
                }
              }}
              title="Insert link"
            >
              🔗
            </button>
          </div>
        )}

        {/* Editor body */}
        <div className="compose-body">
          <EditorContent editor={editor} />
        </div>

        {/* Attached files */}
        {attachedFiles.length > 0 && (
          <div className="attachment-list" style={{ borderTop: "1px solid var(--color-border)" }}>
            {attachedFiles.map((file, i) => (
              <div key={i} className="attachment-chip">
                <span className="icon">📎</span>
                <span>{file.name}</span>
                <button
                  className="btn-icon"
                  onClick={() => removeAttachment(i)}
                  style={{ padding: 0, fontSize: 11 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="compose-footer">
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={handleSend}
              disabled={sending || !to.trim()}
            >
              {sending ? "Sending..." : "Send"}
            </button>
            <button className="btn" onClick={handleAttach}>
              📎 Attach
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>
          <button className="btn" onClick={onClose}>
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
