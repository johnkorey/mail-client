import { graphFetch } from "./graphClient";
import type {
  Message,
  MailFolder,
  Attachment,
  FileAttachment,
  MessageRule,
  ComposeMessage,
  GraphPagedResponse,
  MailSearchOptions,
  FolderTreeNode,
} from "../types/graph";

const LIST_SELECT = [
  "id",
  "subject",
  "from",
  "toRecipients",
  "receivedDateTime",
  "bodyPreview",
  "isRead",
  "isDraft",
  "importance",
  "hasAttachments",
  "flag",
  "categories",
  "conversationId",
  "parentFolderId",
].join(",");

const DEFAULT_SELECT = [
  "id",
  "subject",
  "from",
  "toRecipients",
  "ccRecipients",
  "receivedDateTime",
  "sentDateTime",
  "bodyPreview",
  "body",
  "isRead",
  "isDraft",
  "importance",
  "hasAttachments",
  "flag",
  "categories",
  "conversationId",
  "parentFolderId",
  "inferenceClassification",
].join(",");

// ─── Messages ────────────────────────────────────────────────

export async function getMessages(
  folderId: string = "inbox",
  top: number = 50,
  skip: number = 0
): Promise<GraphPagedResponse<Message>> {
  return graphFetch(`me/mailFolders/${folderId}/messages`, {
    params: {
      $select: LIST_SELECT,
      $top: String(top),
      $skip: String(skip),
      $orderby: "receivedDateTime DESC",
    },
  });
}

export async function getMessage(messageId: string): Promise<Message> {
  return graphFetch(`me/messages/${messageId}`, {
    params: { $select: DEFAULT_SELECT },
  });
}

export async function searchMessages(
  options: MailSearchOptions
): Promise<GraphPagedResponse<Message>> {
  const path = options.folderId
    ? `me/mailFolders/${options.folderId}/messages`
    : "me/messages";

  const params: Record<string, string> = {
    $select: options.select?.join(",") || LIST_SELECT,
    $top: String(options.top || 50),
  };

  if (options.query) params.$search = `"${options.query}"`;
  if (options.filter) params.$filter = options.filter;
  if (options.orderBy) params.$orderby = options.orderBy;
  else params.$orderby = "receivedDateTime DESC";
  if (options.skip) params.$skip = String(options.skip);

  return graphFetch(path, { params });
}

export async function markAsRead(
  messageId: string,
  isRead: boolean = true
): Promise<void> {
  await graphFetch(`me/messages/${messageId}`, {
    method: "PATCH",
    body: { isRead },
  });
}

export async function flagMessage(
  messageId: string,
  flagStatus: "notFlagged" | "flagged" | "complete"
): Promise<void> {
  await graphFetch(`me/messages/${messageId}`, {
    method: "PATCH",
    body: { flag: { flagStatus } },
  });
}

export async function setCategories(
  messageId: string,
  categories: string[]
): Promise<void> {
  await graphFetch(`me/messages/${messageId}`, {
    method: "PATCH",
    body: { categories },
  });
}

export async function moveMessage(
  messageId: string,
  destinationFolderId: string
): Promise<Message> {
  return graphFetch(`me/messages/${messageId}/move`, {
    method: "POST",
    body: { destinationId: destinationFolderId },
  });
}

export async function copyMessage(
  messageId: string,
  destinationFolderId: string
): Promise<Message> {
  return graphFetch(`me/messages/${messageId}/copy`, {
    method: "POST",
    body: { destinationId: destinationFolderId },
  });
}

export async function deleteMessage(messageId: string): Promise<void> {
  await graphFetch(`me/messages/${messageId}`, { method: "DELETE" });
}

export async function setImportance(
  messageId: string,
  importance: "low" | "normal" | "high"
): Promise<void> {
  await graphFetch(`me/messages/${messageId}`, {
    method: "PATCH",
    body: { importance },
  });
}

// ─── Send / Reply / Forward ──────────────────────────────────

export async function sendMail(message: ComposeMessage): Promise<void> {
  await graphFetch("me/sendMail", {
    method: "POST",
    body: {
      message: {
        subject: message.subject,
        body: message.body,
        toRecipients: message.toRecipients,
        ccRecipients: message.ccRecipients,
        bccRecipients: message.bccRecipients,
        importance: message.importance || "normal",
        attachments: message.attachments,
      },
      saveToSentItems: true,
    },
  });
}

export async function createDraft(message: ComposeMessage): Promise<Message> {
  return graphFetch("me/messages", {
    method: "POST",
    body: {
      subject: message.subject,
      body: message.body,
      toRecipients: message.toRecipients,
      ccRecipients: message.ccRecipients,
      bccRecipients: message.bccRecipients,
      importance: message.importance || "normal",
    },
  });
}

export async function updateDraft(
  messageId: string,
  updates: Partial<Message>
): Promise<Message> {
  return graphFetch(`me/messages/${messageId}`, {
    method: "PATCH",
    body: updates,
  });
}

export async function sendDraft(messageId: string): Promise<void> {
  await graphFetch(`me/messages/${messageId}/send`, {
    method: "POST",
    body: {},
  });
}

export async function replyToMessage(
  messageId: string,
  comment: string
): Promise<void> {
  await graphFetch(`me/messages/${messageId}/reply`, {
    method: "POST",
    body: { comment },
  });
}

export async function replyAllToMessage(
  messageId: string,
  comment: string
): Promise<void> {
  await graphFetch(`me/messages/${messageId}/replyAll`, {
    method: "POST",
    body: { comment },
  });
}

export async function forwardMessage(
  messageId: string,
  comment: string,
  toRecipients: { emailAddress: { address: string; name?: string } }[]
): Promise<void> {
  await graphFetch(`me/messages/${messageId}/forward`, {
    method: "POST",
    body: { comment, toRecipients },
  });
}

// ─── Attachments ─────────────────────────────────────────────

export async function getAttachments(
  messageId: string
): Promise<Attachment[]> {
  const response = await graphFetch(`me/messages/${messageId}/attachments`);
  return response.value;
}

export async function getAttachment(
  messageId: string,
  attachmentId: string
): Promise<FileAttachment> {
  return graphFetch(`me/messages/${messageId}/attachments/${attachmentId}`);
}

export async function addAttachment(
  messageId: string,
  file: File
): Promise<Attachment> {
  const contentBytes = await fileToBase64(file);
  return graphFetch(`me/messages/${messageId}/attachments`, {
    method: "POST",
    body: {
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: file.name,
      contentType: file.type,
      contentBytes,
    },
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Folders ─────────────────────────────────────────────────

export async function getMailFolders(): Promise<MailFolder[]> {
  const response = await graphFetch("me/mailFolders", {
    params: { $top: "100" },
  });
  return response.value;
}

export async function getChildFolders(
  folderId: string
): Promise<MailFolder[]> {
  const response = await graphFetch(
    `me/mailFolders/${folderId}/childFolders`,
    { params: { $top: "100" } }
  );
  return response.value;
}

export async function getFolderTree(): Promise<FolderTreeNode[]> {
  const folders = await getMailFolders();
  const tree: FolderTreeNode[] = [];

  for (const folder of folders) {
    const node: FolderTreeNode = { ...folder };
    if (folder.childFolderCount && folder.childFolderCount > 0 && folder.id) {
      node.children = await getChildFolders(folder.id);
    }
    tree.push(node);
  }

  return tree;
}

export async function createFolder(
  displayName: string,
  parentFolderId?: string
): Promise<MailFolder> {
  const endpoint = parentFolderId
    ? `me/mailFolders/${parentFolderId}/childFolders`
    : "me/mailFolders";
  return graphFetch(endpoint, {
    method: "POST",
    body: { displayName },
  });
}

export async function renameFolder(
  folderId: string,
  displayName: string
): Promise<MailFolder> {
  return graphFetch(`me/mailFolders/${folderId}`, {
    method: "PATCH",
    body: { displayName },
  });
}

export async function deleteFolder(folderId: string): Promise<void> {
  await graphFetch(`me/mailFolders/${folderId}`, { method: "DELETE" });
}

// ─── Rules ───────────────────────────────────────────────────

export async function getMailRules(): Promise<MessageRule[]> {
  const response = await graphFetch("me/mailFolders/inbox/messageRules");
  return response.value;
}

export async function createMailRule(
  rule: Partial<MessageRule>
): Promise<MessageRule> {
  return graphFetch("me/mailFolders/inbox/messageRules", {
    method: "POST",
    body: rule,
  });
}

export async function deleteMailRule(ruleId: string): Promise<void> {
  await graphFetch(`me/mailFolders/inbox/messageRules/${ruleId}`, {
    method: "DELETE",
  });
}

// ─── Delta Sync ──────────────────────────────────────────────

export async function getDelta(
  folderId: string = "inbox",
  deltaLink?: string
): Promise<GraphPagedResponse<Message>> {
  if (deltaLink) {
    return graphFetch(deltaLink);
  }
  return graphFetch(`me/mailFolders/${folderId}/messages/delta`, {
    params: { $select: LIST_SELECT, $top: "50" },
  });
}

// ─── Mailbox Settings ────────────────────────────────────────

export async function getMailboxSettings() {
  return graphFetch("me/mailboxSettings");
}

export async function updateAutoReply(settings: {
  status: "disabled" | "alwaysEnabled" | "scheduled";
  externalReplyMessage?: string;
  internalReplyMessage?: string;
}) {
  return graphFetch("me/mailboxSettings", {
    method: "PATCH",
    body: { automaticRepliesSetting: settings },
  });
}

// ─── Categories ──────────────────────────────────────────────

export async function getCategories() {
  const response = await graphFetch("me/outlook/masterCategories");
  return response.value;
}
