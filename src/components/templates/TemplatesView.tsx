import { useState } from "react";

interface Template {
  id: string;
  name: string;
  category: "message" | "letter";
  subject: string;
  body: string;
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "follow-up",
    name: "Follow Up",
    category: "message",
    subject: "Following Up",
    body: `<p>Hi,</p><p>I wanted to follow up on our previous conversation. Please let me know if you have any updates or if there's anything else I can help with.</p><p>Looking forward to hearing from you.</p><p>Best regards</p>`,
  },
  {
    id: "meeting-request",
    name: "Meeting Request",
    category: "message",
    subject: "Meeting Request",
    body: `<p>Hi,</p><p>I would like to schedule a meeting to discuss [topic]. Would you be available on [date] at [time]?</p><p>Please let me know what works best for you.</p><p>Thank you</p>`,
  },
  {
    id: "thank-you",
    name: "Thank You",
    category: "message",
    subject: "Thank You",
    body: `<p>Hi,</p><p>Thank you for [reason]. I really appreciate your time and effort.</p><p>Best regards</p>`,
  },
  {
    id: "introduction",
    name: "Introduction",
    category: "message",
    subject: "Introduction",
    body: `<p>Hi,</p><p>My name is [Your Name] and I am reaching out regarding [reason]. I would love the opportunity to connect and discuss how we might work together.</p><p>Looking forward to your response.</p><p>Best regards</p>`,
  },
  {
    id: "out-of-office",
    name: "Out of Office",
    category: "message",
    subject: "Out of Office",
    body: `<p>Hi,</p><p>Thank you for your email. I am currently out of the office from [start date] to [end date] with limited access to email.</p><p>I will respond to your message upon my return. For urgent matters, please contact [alternative contact].</p><p>Best regards</p>`,
  },
  {
    id: "formal-letter",
    name: "Formal Business Letter",
    category: "letter",
    subject: "",
    body: `<p>[Your Name]<br/>[Your Address]<br/>[City, State, ZIP]<br/>[Date]</p><p>[Recipient Name]<br/>[Recipient Title]<br/>[Company Name]<br/>[Company Address]</p><p>Dear [Recipient Name],</p><p>I am writing to [purpose of the letter]. [Body of the letter with details].</p><p>Thank you for your attention to this matter. I look forward to your response.</p><p>Sincerely,<br/>[Your Name]<br/>[Your Title]</p>`,
  },
  {
    id: "cover-letter",
    name: "Cover Letter",
    category: "letter",
    subject: "Application for [Position]",
    body: `<p>Dear Hiring Manager,</p><p>I am writing to express my interest in the [Position] role at [Company Name]. With my background in [field/skill], I am confident in my ability to contribute to your team.</p><p>[Paragraph about relevant experience and skills].</p><p>[Paragraph about why you're interested in the company].</p><p>Thank you for considering my application. I look forward to the opportunity to discuss how I can contribute to your organization.</p><p>Sincerely,<br/>[Your Name]</p>`,
  },
  {
    id: "complaint-letter",
    name: "Complaint Letter",
    category: "letter",
    subject: "Formal Complaint Regarding [Issue]",
    body: `<p>Dear [Recipient],</p><p>I am writing to formally bring to your attention [describe the issue]. This matter occurred on [date] and has caused [describe impact].</p><p>I have previously attempted to resolve this by [previous actions taken], but the issue remains unresolved.</p><p>I would appreciate if you could [desired resolution] at your earliest convenience. Please respond within [timeframe].</p><p>Thank you for your prompt attention to this matter.</p><p>Sincerely,<br/>[Your Name]<br/>[Contact Information]</p>`,
  },
  {
    id: "invoice-reminder",
    name: "Invoice Reminder",
    category: "letter",
    subject: "Payment Reminder - Invoice #[Number]",
    body: `<p>Dear [Client Name],</p><p>This is a friendly reminder that Invoice #[Number] dated [Date] for the amount of [Amount] is now past due.</p><p>If payment has already been sent, please disregard this notice. Otherwise, we kindly request that payment be made at your earliest convenience.</p><p>If you have any questions regarding this invoice, please do not hesitate to contact us.</p><p>Thank you for your prompt attention.</p><p>Best regards,<br/>[Your Name]<br/>[Company Name]</p>`,
  },
];

const STORAGE_KEY = "mail-client-templates";

function loadCustomTemplates(): Template[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCustomTemplates(templates: Template[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

interface TemplatesViewProps {
  onUseTemplate: (subject: string, body: string) => void;
}

export function TemplatesView({ onUseTemplate }: TemplatesViewProps) {
  const [customTemplates, setCustomTemplates] = useState<Template[]>(loadCustomTemplates);
  const [activeCategory, setActiveCategory] = useState<"all" | "message" | "letter" | "custom">("all");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<"message" | "letter">("message");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");

  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];

  const filtered = activeCategory === "all"
    ? allTemplates
    : activeCategory === "custom"
      ? customTemplates
      : allTemplates.filter((t) => t.category === activeCategory);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const template: Template = {
      id: `custom-${Date.now()}`,
      name: newName,
      category: newCategory,
      subject: newSubject,
      body: newBody || `<p>${newBody}</p>`,
    };
    const updated = [...customTemplates, template];
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    setCreating(false);
    setNewName("");
    setNewSubject("");
    setNewBody("");
  };

  const handleDelete = (id: string) => {
    const updated = customTemplates.filter((t) => t.id !== id);
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    if (selectedTemplate?.id === id) setSelectedTemplate(null);
  };

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      {/* Template list */}
      <div style={{ width: 320, minWidth: 320, borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Templates</h2>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(["all", "message", "letter", "custom"] as const).map((cat) => (
              <button
                key={cat}
                className={`btn ${activeCategory === cat ? "btn-primary" : ""}`}
                onClick={() => setActiveCategory(cat)}
                style={{ padding: "4px 12px", fontSize: 12, textTransform: "capitalize" }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.map((t) => (
            <div
              key={t.id}
              onClick={() => { setSelectedTemplate(t); setCreating(false); }}
              style={{
                padding: "12px 20px",
                borderBottom: "1px solid var(--color-border)",
                cursor: "pointer",
                background: selectedTemplate?.id === t.id ? "var(--color-bg-active)" : "transparent",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{t.name}</div>
                <span style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: t.category === "letter" ? "#e8f0fe" : "#f0f4e8",
                  color: t.category === "letter" ? "var(--color-primary)" : "var(--color-success)",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}>
                  {t.category}
                </span>
              </div>
              {t.subject && (
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.subject}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: 12, borderTop: "1px solid var(--color-border)" }}>
          <button
            className="btn"
            onClick={() => { setCreating(true); setSelectedTemplate(null); }}
            style={{ width: "100%", justifyContent: "center", padding: "8px 0" }}
          >
            + Create Template
          </button>
        </div>
      </div>

      {/* Template preview / Create form */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {creating ? (
          <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Create New Template</h3>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Template Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Weekly Report"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Category</label>
              <div style={{ display: "flex", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="radio" checked={newCategory === "message"} onChange={() => setNewCategory("message")} />
                  Message
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="radio" checked={newCategory === "letter"} onChange={() => setNewCategory("letter")} />
                  Letter
                </label>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Subject Line</label>
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Email subject"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Body (HTML or plain text)</label>
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Write your template content..."
                rows={10}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: 13, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim()} style={{ padding: "8px 24px" }}>
                Save Template
              </button>
              <button className="btn" onClick={() => setCreating(false)} style={{ padding: "8px 24px" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : selectedTemplate ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>{selectedTemplate.name}</h3>
                {selectedTemplate.subject && (
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }}>
                    Subject: {selectedTemplate.subject}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => onUseTemplate(selectedTemplate.subject, selectedTemplate.body)}
                  style={{ padding: "8px 20px" }}
                >
                  Use Template
                </button>
                {selectedTemplate.id.startsWith("custom-") && (
                  <button
                    className="btn"
                    onClick={() => handleDelete(selectedTemplate.id)}
                    style={{ padding: "8px 16px", color: "var(--color-danger)", border: "1px solid var(--color-danger)" }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <div
                style={{ fontSize: 14, lineHeight: 1.7, color: "var(--color-text)" }}
                dangerouslySetInnerHTML={{ __html: selectedTemplate.body }}
              />
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "var(--color-text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <p>Select a template to preview</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>or create your own</p>
          </div>
        )}
      </div>
    </div>
  );
}
