import axiosInstance from "@/lib/axios";
import { SETTINGS_ENDPOINTS } from "@/lib/api-endpoints";

export type EmailEncryption = "TLS" | "SSL" | "NONE";

export interface EmailConfig {
  id: number;
  label: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  from_email: string;
  from_name: string;
  encryption: EmailEncryption;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailConfigPayload {
  label: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
  encryption: EmailEncryption;
  is_active: boolean;
}

export async function fetchEmailConfigs(): Promise<EmailConfig[]> {
  const res = await axiosInstance.get<EmailConfig[]>(SETTINGS_ENDPOINTS.emailConfig);
  return res.data;
}

export async function createEmailConfig(payload: EmailConfigPayload): Promise<EmailConfig> {
  const res = await axiosInstance.post<EmailConfig>(SETTINGS_ENDPOINTS.emailConfig, payload);
  return res.data;
}

export async function updateEmailConfig(id: number, payload: EmailConfigPayload): Promise<EmailConfig> {
  const res = await axiosInstance.put<EmailConfig>(SETTINGS_ENDPOINTS.emailConfigDetail(id), payload);
  return res.data;
}

export async function deleteEmailConfig(id: number): Promise<void> {
  await axiosInstance.delete(SETTINGS_ENDPOINTS.emailConfigDetail(id));
}

export async function sendTestEmail(id: number, recipient: string): Promise<{ detail: string }> {
  const res = await axiosInstance.post<{ detail: string }>(
    SETTINGS_ENDPOINTS.emailConfigTest(id),
    { recipient }
  );
  return res.data;
}

export interface ComposeEmailPayload {
  to: string;
  cc?: string;
  subject: string;
  body: string;
}

export async function sendReservationEmail(
  payload: ComposeEmailPayload
): Promise<{ detail: string }> {
  const res = await axiosInstance.post<{ detail: string }>(
    SETTINGS_ENDPOINTS.reservationEmailSend,
    payload
  );
  return res.data;
}

export interface ReservationEmailRecord {
  id: number;
  reservation: number;
  sent_by: number | null;
  sent_by_name: string | null;
  direction: string;
  to_address: string;
  cc_address: string;
  subject: string;
  body: string;
  sent_at: string;
  is_successful: boolean;
  error_message: string;
}

export async function fetchReservationEmailHistory(
  reservationId: number
): Promise<ReservationEmailRecord[]> {
  const res = await axiosInstance.get<ReservationEmailRecord[]>(
    SETTINGS_ENDPOINTS.reservationEmailHistory(reservationId)
  );
  return res.data;
}