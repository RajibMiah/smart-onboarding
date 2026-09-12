export interface LoginCredentials {
  email: string;
  password: string;
}

export interface WorkspaceRegistration {
  email: string;
  acceptedPrivacyPolicy: boolean;
}

export interface OtpPayload {
  email: string;
  code: string;
}

export interface PasswordResetRequest {
  email: string;
}
