import type * as MicrosoftGraph from "@microsoft/microsoft-graph-types";

// Re-export commonly used Graph types
export type Message = MicrosoftGraph.Message;
export type MailFolder = MicrosoftGraph.MailFolder;
export type Attachment = MicrosoftGraph.Attachment;
export type FileAttachment = MicrosoftGraph.FileAttachment;
export type Contact = MicrosoftGraph.Contact;
export type Event = MicrosoftGraph.Event;
export type User = MicrosoftGraph.User;
export type MessageRule = MicrosoftGraph.MessageRule;
export type Recipient = MicrosoftGraph.Recipient;
export type ItemBody = MicrosoftGraph.ItemBody;
export type DateTimeTimeZone = MicrosoftGraph.DateTimeTimeZone;

// Paged response from Graph API
export interface GraphPagedResponse<T> {
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
  "@odata.count"?: number;
  value: T[];
}

// Compose message draft
export interface ComposeMessage {
  subject: string;
  body: ItemBody;
  toRecipients: Recipient[];
  ccRecipients?: Recipient[];
  bccRecipients?: Recipient[];
  importance?: "low" | "normal" | "high";
  attachments?: FileAttachment[];
}

// Well-known folder names
export type WellKnownFolder =
  | "inbox"
  | "drafts"
  | "sentitems"
  | "deleteditems"
  | "junkemail"
  | "archive";

// Folder tree node (folder + children)
export interface FolderTreeNode extends MailFolder {
  children?: FolderTreeNode[];
}

// Search options
export interface MailSearchOptions {
  query?: string;
  folderId?: string;
  filter?: string;
  orderBy?: string;
  top?: number;
  skip?: number;
  select?: string[];
}
