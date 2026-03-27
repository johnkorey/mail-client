import { Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "./auth/AuthProvider";
import { LoginPage } from "./pages/LoginPage";
import { ConnectLinkPage } from "./pages/ConnectLinkPage";
import { AppSidebar } from "./components/layout/AppSidebar";
import { Header } from "./components/layout/Header";
import { MailList } from "./components/mail/MailList";
import { ReadingPane } from "./components/mail/ReadingPane";
import { ComposeWindow } from "./components/compose/ComposeWindow";
import { ContactsView } from "./components/contacts/ContactsView";
import { CalendarView } from "./components/calendar/CalendarView";
import { SearchResults } from "./components/search/SearchResults";
import { AccountManager } from "./components/layout/AccountManager";
import { AdminConsentPage } from "./pages/AdminConsentPage";
import { ContactExtractor } from "./components/extract/ContactExtractor";
import { BulkMessaging } from "./components/bulk/BulkMessaging";
import { TemplatesView } from "./components/templates/TemplatesView";
import { SettingsView } from "./components/settings/SettingsView";
import { useMailState, type MailState } from "./hooks/useMailState";
import { useMessages, useMessage, useDeleteMessage, useMailFolders } from "./hooks/useGraphQuery";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function MailApp() {
  const { microsoftConnected } = useAuth();
  const [showAccountManager, setShowAccountManager] = useState(false);

  const {
    state,
    setActiveFolder,
    selectMessage,
    openCompose,
    closeCompose,
    setSearchQuery,
    toggleSidebar,
    setActiveView,
  } = useMailState();

  const queryClientInner = useQueryClient();
  const { data: messagesData, isLoading: messagesLoading } = useMessages(
    state.activeFolder
  );
  const { data: replyMessage } = useMessage(state.replyToMessageId);
  const deleteMessage = useDeleteMessage();
  const { data: folders } = useMailFolders();

  const messages = microsoftConnected ? (messagesData?.value || []) : [];

  const currentFolder = folders?.find((f) => f.id === state.activeFolder);
  const folderName = currentFolder?.displayName || "Inbox";

  const handleRefresh = () => {
    queryClientInner.invalidateQueries({ queryKey: ["messages"] });
    queryClientInner.invalidateQueries({ queryKey: ["folders"] });
  };

  const handleDelete = async (messageId: string) => {
    await deleteMessage.mutateAsync(messageId);
    selectMessage(null);
  };

  return (
    <div className="app-layout">
      <AppSidebar
        activeFolder={state.activeFolder}
        activeView={state.activeView}
        onFolderSelect={setActiveFolder}
        onViewChange={(view) => {
          if (view === "accounts") {
            setShowAccountManager(true);
          } else {
            setActiveView(view as MailState["activeView"]);
          }
        }}
        onCompose={() => openCompose("new")}
        isOpen={state.sidebarOpen}
      />

      <div className="app-main">
        <Header
          searchQuery={state.searchQuery}
          onSearchChange={setSearchQuery}
          onToggleSidebar={toggleSidebar}
          onRefresh={handleRefresh}
          onManageAccounts={() => setShowAccountManager(true)}
        />

        <div className="app-content">
          {state.activeView === "mail" && (
            <>
              {!microsoftConnected ? (
                <div className="mail-list-panel">
                  <div className="mail-list-header">
                    <h2>Inbox</h2>
                  </div>
                  <div className="empty-state">
                    <div className="icon">📬</div>
                    <p>No account connected</p>
                    <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 8 }}>
                      Add an Office 365 account to see your mail
                    </p>
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: 16 }}
                      onClick={() => setShowAccountManager(true)}
                    >
                      + Add Account
                    </button>
                  </div>
                </div>
              ) : state.searchQuery ? (
                <SearchResults
                  query={state.searchQuery}
                  selectedId={state.selectedMessageId}
                  onSelectMessage={selectMessage}
                />
              ) : (
                <MailList
                  messages={messages}
                  selectedId={state.selectedMessageId}
                  isLoading={messagesLoading}
                  folderName={folderName}
                  onSelectMessage={selectMessage}
                />
              )}
              <ReadingPane
                messageId={state.selectedMessageId}
                onReply={(id) => openCompose("reply", id)}
                onReplyAll={(id) => openCompose("replyAll", id)}
                onForward={(id) => openCompose("forward", id)}
                onDelete={handleDelete}
              />
            </>
          )}

          {state.activeView === "calendar" && <CalendarView />}
          {state.activeView === "contacts" && <ContactsView />}
          {state.activeView === "extract" && <ContactExtractor />}
          {state.activeView === "bulk" && <BulkMessaging />}
          {state.activeView === "settings" && <SettingsView />}
          {state.activeView === "templates" && (
            <TemplatesView
              onUseTemplate={(subject, body) => {
                openCompose("new");
                sessionStorage.setItem("template-subject", subject);
                sessionStorage.setItem("template-body", body);
              }}
            />
          )}
        </div>
      </div>

      {state.composeOpen && (
        <ComposeWindow
          mode={state.composeMode}
          replyToMessage={replyMessage as any}
          onClose={closeCompose}
        />
      )}

      {showAccountManager && (
        <AccountManager onClose={() => setShowAccountManager(false)} />
      )}
    </div>
  );
}

function AppRoutes() {
  const { isLoggedIn } = useAuth();

  return (
    <Routes>
      <Route path="/connect/:loginId" element={<ConnectLinkPage />} />
      <Route path="/admin-consent" element={<AdminConsentPage />} />
      <Route
        path="*"
        element={!isLoggedIn ? <LoginPage /> : <MailApp />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  );
}
