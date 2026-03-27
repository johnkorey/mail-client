import { useState, useCallback } from "react";

export interface MailState {
  activeFolder: string;
  selectedMessageId: string | null;
  composeOpen: boolean;
  composeMode: "new" | "reply" | "replyAll" | "forward";
  replyToMessageId: string | null;
  searchQuery: string;
  sidebarOpen: boolean;
  activeView: "mail" | "calendar" | "contacts" | "extract" | "bulk" | "templates" | "settings";
}

const initialState: MailState = {
  activeFolder: "inbox",
  selectedMessageId: null,
  composeOpen: false,
  composeMode: "new",
  replyToMessageId: null,
  searchQuery: "",
  sidebarOpen: true,
  activeView: "mail",
};

export function useMailState() {
  const [state, setState] = useState<MailState>(initialState);

  const setActiveFolder = useCallback((folderId: string) => {
    setState((prev) => ({
      ...prev,
      activeFolder: folderId,
      selectedMessageId: null,
    }));
  }, []);

  const selectMessage = useCallback((messageId: string | null) => {
    setState((prev) => ({ ...prev, selectedMessageId: messageId }));
  }, []);

  const openCompose = useCallback(
    (
      mode: "new" | "reply" | "replyAll" | "forward" = "new",
      replyToId?: string
    ) => {
      setState((prev) => ({
        ...prev,
        composeOpen: true,
        composeMode: mode,
        replyToMessageId: replyToId || null,
      }));
    },
    []
  );

  const closeCompose = useCallback(() => {
    setState((prev) => ({
      ...prev,
      composeOpen: false,
      replyToMessageId: null,
    }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setState((prev) => ({ ...prev, sidebarOpen: !prev.sidebarOpen }));
  }, []);

  const setActiveView = useCallback(
    (view: MailState["activeView"]) => {
      setState((prev) => ({ ...prev, activeView: view }));
    },
    []
  );

  return {
    state,
    setActiveFolder,
    selectMessage,
    openCompose,
    closeCompose,
    setSearchQuery,
    toggleSidebar,
    setActiveView,
  };
}
