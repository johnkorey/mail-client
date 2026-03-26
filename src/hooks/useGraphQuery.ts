import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as mailService from "../services/mailService";
import * as contactsService from "../services/contactsService";
import * as calendarService from "../services/calendarService";
import type { ComposeMessage } from "../types/graph";

// ─── Mail Queries ────────────────────────────────────────────

export function useMessages(folderId: string, top = 50, skip = 0) {
  return useQuery({
    queryKey: ["messages", folderId, top, skip],
    queryFn: () => mailService.getMessages(folderId, top, skip),
    staleTime: 30_000, // 30 seconds
  });
}

export function useMessage(messageId: string | null) {
  return useQuery({
    queryKey: ["message", messageId],
    queryFn: () => mailService.getMessage(messageId!),
    enabled: !!messageId,
  });
}

export function useSearchMessages(query: string, folderId?: string) {
  return useQuery({
    queryKey: ["search", query, folderId],
    queryFn: () =>
      mailService.searchMessages({ query, folderId, top: 50 }),
    enabled: query.length > 0,
    staleTime: 60_000,
  });
}

export function useMailFolders() {
  return useQuery({
    queryKey: ["folders"],
    queryFn: () => mailService.getFolderTree(),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useAttachments(messageId: string | null) {
  return useQuery({
    queryKey: ["attachments", messageId],
    queryFn: () => mailService.getAttachments(messageId!),
    enabled: !!messageId,
  });
}

export function useMailRules() {
  return useQuery({
    queryKey: ["mailRules"],
    queryFn: mailService.getMailRules,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: mailService.getCategories,
    staleTime: 10 * 60_000,
  });
}

// ─── Mail Mutations ──────────────────────────────────────────

export function useSendMail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: ComposeMessage) => mailService.sendMail(message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      messageId,
      isRead,
    }: {
      messageId: string;
      isRead: boolean;
    }) => mailService.markAsRead(messageId, isRead),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });
}

export function useFlagMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      messageId,
      flagStatus,
    }: {
      messageId: string;
      flagStatus: "notFlagged" | "flagged" | "complete";
    }) => mailService.flagMessage(messageId, flagStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export function useMoveMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      messageId,
      destinationFolderId,
    }: {
      messageId: string;
      destinationFolderId: string;
    }) => mailService.moveMessage(messageId, destinationFolderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => mailService.deleteMessage(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });
}

export function useReplyToMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      messageId,
      comment,
    }: {
      messageId: string;
      comment: string;
    }) => mailService.replyToMessage(messageId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export function useForwardMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      messageId,
      comment,
      toRecipients,
    }: {
      messageId: string;
      comment: string;
      toRecipients: { emailAddress: { address: string; name?: string } }[];
    }) => mailService.forwardMessage(messageId, comment, toRecipients),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      displayName,
      parentFolderId,
    }: {
      displayName: string;
      parentFolderId?: string;
    }) => mailService.createFolder(displayName, parentFolderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (folderId: string) => mailService.deleteFolder(folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });
}

// ─── Contact Queries ─────────────────────────────────────────

export function useContacts(top = 50, skip = 0) {
  return useQuery({
    queryKey: ["contacts", top, skip],
    queryFn: () => contactsService.getContacts(top, skip),
    staleTime: 5 * 60_000,
  });
}

export function useSearchPeople(query: string) {
  return useQuery({
    queryKey: ["people", query],
    queryFn: () => contactsService.searchPeople(query),
    enabled: query.length > 1,
    staleTime: 30_000,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: contactsService.createContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: contactsService.deleteContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

// ─── Calendar Queries ────────────────────────────────────────

export function useCalendarEvents(startDateTime: string, endDateTime: string) {
  return useQuery({
    queryKey: ["events", startDateTime, endDateTime],
    queryFn: () => calendarService.getEvents(startDateTime, endDateTime),
    enabled: !!startDateTime && !!endDateTime,
    staleTime: 60_000,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: calendarService.createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: calendarService.deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
