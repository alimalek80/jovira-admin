"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchEmailConfigs,
  createEmailConfig,
  updateEmailConfig,
  deleteEmailConfig,
  sendTestEmail,
  type EmailConfig,
  type EmailConfigPayload,
} from "@/lib/api/email-config";

const ENCRYPTION_OPTIONS = [
  { value: "TLS", label: "TLS (STARTTLS) — recommended, port 587" },
  { value: "SSL", label: "SSL/TLS — port 465" },
  { value: "NONE", label: "None — port 25 (not recommended)" },
] as const;

const DEFAULT_FORM: EmailConfigPayload = {
  label: "Default Email Config",
  smtp_host: "",
  smtp_port: 587,
  smtp_username: "",
  smtp_password: "",
  from_email: "",
  from_name: "",
  encryption: "TLS",
  is_active: true,
};

export default function EmailSettingsPage() {
  const queryClient = useQueryClient();

  const [form, setForm] = useState<EmailConfigPayload>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testMessage, setTestMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["email-configs"],
    queryFn: fetchEmailConfigs,
  });

  const createMutation = useMutation({
    mutationFn: createEmailConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-configs"] });
      setForm(DEFAULT_FORM);
      setEditingId(null);
      setFormError(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(msg ?? "Failed to save configuration.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: EmailConfigPayload }) =>
      updateEmailConfig(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-configs"] });
      setForm(DEFAULT_FORM);
      setEditingId(null);
      setFormError(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(msg ?? "Failed to update configuration.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEmailConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-configs"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: ({ id, recipient }: { id: number; recipient: string }) =>
      sendTestEmail(id, recipient),
    onSuccess: (data) => {
      setTestMessage({ type: "success", text: data.detail });
      setTestingId(null);
      setTestRecipient("");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setTestMessage({ type: "error", text: msg ?? "Test email failed." });
    },
  });

  function handleEdit(config: EmailConfig) {
    setEditingId(config.id);
    setForm({
      label: config.label,
      smtp_host: config.smtp_host,
      smtp_port: config.smtp_port,
      smtp_username: config.smtp_username,
      smtp_password: "",
      from_email: config.from_email,
      from_name: config.from_name,
      encryption: config.encryption,
      is_active: config.is_active,
    });
    setFormError(null);
  }

  function handleCancel() {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, payload: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Email Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure the outgoing SMTP account used to send emails from Jovira.
          Only one configuration can be active at a time.
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-lg p-6 space-y-4"
      >
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {editingId !== null ? "Edit Configuration" : "New Configuration"}
        </h2>

        {formError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {formError}
          </div>
        )}

        {/* Label */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2347]"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            required
          />
        </div>

        {/* SMTP Host + Port */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
            <input
              type="text"
              placeholder="smtp.gmail.com"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2347]"
              value={form.smtp_host}
              onChange={(e) => setForm((f) => ({ ...f, smtp_host: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2347]"
              value={form.smtp_port}
              onChange={(e) => setForm((f) => ({ ...f, smtp_port: Number(e.target.value) }))}
              required
              min={1}
              max={65535}
            />
          </div>
        </div>

        {/* Encryption */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Encryption</label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2347]"
            value={form.encryption}
            onChange={(e) =>
              setForm((f) => ({ ...f, encryption: e.target.value as EmailConfigPayload["encryption"] }))
            }
          >
            {ENCRYPTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Username + Password */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Username</label>
            <input
              type="text"
              placeholder="your@email.com"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2347]"
              value={form.smtp_username}
              onChange={(e) => setForm((f) => ({ ...f, smtp_username: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SMTP Password
              {editingId !== null && (
                <span className="ml-1 text-xs text-gray-400">(leave blank to keep current)</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2347] pr-16"
                value={form.smtp_password}
                onChange={(e) => setForm((f) => ({ ...f, smtp_password: e.target.value }))}
                required={editingId === null}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>

        {/* From Email + From Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
            <input
              type="email"
              placeholder="noreply@youragency.com"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2347]"
              value={form.from_email}
              onChange={(e) => setForm((f) => ({ ...f, from_email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
            <input
              type="text"
              placeholder="Jovira Reservations"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2347]"
              value={form.from_name}
              onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))}
            />
          </div>
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-2">
          <input
            id="is_active"
            type="checkbox"
            className="h-4 w-4 accent-[#0f2347]"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          <label htmlFor="is_active" className="text-sm text-gray-700">
            Set as active configuration
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-[#0f2347] text-white text-sm px-5 py-2 rounded hover:bg-[#1a3560] disabled:opacity-50"
          >
            {isSaving ? "Saving..." : editingId !== null ? "Update" : "Save Configuration"}
          </button>
          {editingId !== null && (
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Saved configs list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Saved Configurations
        </h2>

        {isLoading && (
          <p className="text-sm text-gray-400">Loading...</p>
        )}

        {!isLoading && configs.length === 0 && (
          <p className="text-sm text-gray-400">No configurations saved yet.</p>
        )}

        {configs.map((config) => (
          <div
            key={config.id}
            className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{config.label}</span>
                  {config.is_active && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {config.smtp_host}:{config.smtp_port} · {config.encryption} · {config.from_email}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleEdit(config)}
                  className="text-xs text-[#0f2347] hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${config.label}"?`)) {
                      deleteMutation.mutate(config.id);
                    }
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Test email */}
            <div className="border-t border-gray-100 pt-3">
              {testingId === config.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="Send test to..."
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-1 focus:ring-[#0f2347]"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                  />
                  <button
                    onClick={() => testMutation.mutate({ id: config.id, recipient: testRecipient })}
                    disabled={testMutation.isPending || !testRecipient}
                    className="bg-[#0f2347] text-white text-xs px-3 py-1.5 rounded hover:bg-[#1a3560] disabled:opacity-50"
                  >
                    {testMutation.isPending ? "Sending..." : "Send"}
                  </button>
                  <button
                    onClick={() => { setTestingId(null); setTestRecipient(""); setTestMessage(null); }}
                    className="text-xs text-gray-500 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setTestingId(config.id); setTestMessage(null); }}
                  className="text-xs text-gray-500 hover:text-[#0f2347] underline"
                >
                  Send test email
                </button>
              )}

              {testMessage && testingId === null && (
                <p className={`text-xs mt-2 ${testMessage.type === "success" ? "text-green-600" : "text-red-500"}`}>
                  {testMessage.text}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}