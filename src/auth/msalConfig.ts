import type { Configuration } from "@azure/msal-browser";
import { LogLevel } from "@azure/msal-browser";

// Replace these with your Azure App Registration values
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || "YOUR_CLIENT_ID",
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || "common"}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "localStorage",
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            break;
          case LogLevel.Warning:
            console.warn(message);
            break;
        }
      },
      logLevel: LogLevel.Warning,
    },
  },
};

// Microsoft Graph scopes for full mail client
// Note: Some scopes require admin consent. Start with user-consentable
// scopes and request more via incremental consent when needed.
export const graphScopes = {
  mail: ["Mail.ReadWrite", "Mail.Send"],
  mailShared: ["Mail.Read.Shared", "Mail.Send.Shared"],
  mailboxSettings: ["MailboxSettings.ReadWrite"],
  calendars: ["Calendars.ReadWrite"],
  contacts: ["Contacts.ReadWrite"],
  people: ["People.Read"],
  user: ["User.Read"],
};

// Login scopes — only request user-consentable scopes at login.
// Mail.ReadWrite, Mail.Send, Calendars.ReadWrite, Contacts.ReadWrite
// are all user-consentable in most tenants.
export const loginScopes = [
  "User.Read",
  "Mail.ReadWrite",
  "Mail.Send",
  "Calendars.ReadWrite",
  "Contacts.ReadWrite",
];
