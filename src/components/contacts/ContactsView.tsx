import { useState } from "react";
import { useContacts, useCreateContact, useDeleteContact } from "../../hooks/useGraphQuery";
import { getInitials } from "../../utils/formatters";
import type { Contact } from "../../types/graph";

export function ContactsView() {
  const { data: contactsResponse, isLoading } = useContacts();
  const createContact = useCreateContact();
  const deleteContact = useDeleteContact();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newContact, setNewContact] = useState({
    givenName: "",
    surname: "",
    emailAddresses: [{ address: "" }],
    mobilePhone: "",
    companyName: "",
  });

  const contacts = contactsResponse?.value || [];

  const handleCreate = async () => {
    if (!newContact.givenName || !newContact.emailAddresses[0].address) return;
    try {
      await createContact.mutateAsync({
        givenName: newContact.givenName,
        surname: newContact.surname,
        emailAddresses: newContact.emailAddresses.filter((e) => e.address),
        mobilePhone: newContact.mobilePhone || undefined,
        companyName: newContact.companyName || undefined,
      });
      setShowCreate(false);
      setNewContact({
        givenName: "",
        surname: "",
        emailAddresses: [{ address: "" }],
        mobilePhone: "",
        companyName: "",
      });
    } catch (error) {
      console.error("Failed to create contact:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this contact?")) {
      await deleteContact.mutateAsync(id);
      setSelectedContact(null);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* Contacts list */}
      <div style={{ width: 380, borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column" }}>
        <div className="mail-list-header">
          <h2>Contacts</h2>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + New
          </button>
        </div>

        {isLoading ? (
          <div className="loading-spinner" />
        ) : (
          <div className="contacts-list" style={{ flex: 1, overflowY: "auto" }}>
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="contact-item"
                onClick={() => setSelectedContact(contact)}
                style={{
                  background: selectedContact?.id === contact.id ? "var(--color-bg-active)" : undefined,
                }}
              >
                <div className="contact-avatar">
                  {getInitials(contact.displayName || "?")}
                </div>
                <div className="contact-info">
                  <div className="contact-name">{contact.displayName}</div>
                  <div className="contact-email">
                    {contact.emailAddresses?.[0]?.address || ""}
                  </div>
                </div>
              </div>
            ))}
            {contacts.length === 0 && (
              <div className="empty-state">
                <p>No contacts found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contact detail / Create form */}
      <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        {showCreate ? (
          <div>
            <h2 style={{ marginBottom: 20 }}>New Contact</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
              <input
                className="compose-field"
                placeholder="First name"
                value={newContact.givenName}
                onChange={(e) =>
                  setNewContact({ ...newContact, givenName: e.target.value })
                }
                style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}
              />
              <input
                placeholder="Last name"
                value={newContact.surname}
                onChange={(e) =>
                  setNewContact({ ...newContact, surname: e.target.value })
                }
                style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}
              />
              <input
                placeholder="Email address"
                type="email"
                value={newContact.emailAddresses[0].address}
                onChange={(e) =>
                  setNewContact({
                    ...newContact,
                    emailAddresses: [{ address: e.target.value }],
                  })
                }
                style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}
              />
              <input
                placeholder="Mobile phone"
                value={newContact.mobilePhone}
                onChange={(e) =>
                  setNewContact({ ...newContact, mobilePhone: e.target.value })
                }
                style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}
              />
              <input
                placeholder="Company"
                value={newContact.companyName}
                onChange={(e) =>
                  setNewContact({ ...newContact, companyName: e.target.value })
                }
                style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" onClick={handleCreate}>
                  Save
                </button>
                <button className="btn" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : selectedContact ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div className="contact-avatar" style={{ width: 64, height: 64, fontSize: 24 }}>
                {getInitials(selectedContact.displayName || "?")}
              </div>
              <div>
                <h2>{selectedContact.displayName}</h2>
                <div style={{ color: "var(--color-text-secondary)" }}>
                  {selectedContact.companyName}
                  {selectedContact.jobTitle && ` — ${selectedContact.jobTitle}`}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {selectedContact.emailAddresses?.map((email, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 2 }}>
                    Email
                  </div>
                  <div>{email.address}</div>
                </div>
              ))}
              {selectedContact.mobilePhone && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 2 }}>
                    Mobile
                  </div>
                  <div>{selectedContact.mobilePhone}</div>
                </div>
              )}
              {selectedContact.businessPhones?.map((phone, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 2 }}>
                    Business Phone
                  </div>
                  <div>{phone}</div>
                </div>
              ))}
              <div style={{ marginTop: 16 }}>
                <button
                  className="btn btn-danger"
                  onClick={() => selectedContact.id && handleDelete(selectedContact.id)}
                >
                  Delete Contact
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <p>Select a contact to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
