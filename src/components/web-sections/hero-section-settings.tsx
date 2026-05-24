"use client";

import { useMemo, useState } from "react";
import type { HeroSectionResponse, HeroSectionUpdateInput } from "@/lib/api/public-site";

type HeroSectionSettingsProps = {
  data?: HeroSectionResponse;
  isLoading: boolean;
  isSaving: boolean;
  loadError?: string;
  saveError?: string;
  saveSuccess?: string;
  onSave: (payload: HeroSectionUpdateInput) => Promise<void>;
};

type HeroFormState = {
  image: string;
  imageFile: File | null;
  imagePreviewDataUrl: string;
  tagline: string;
  title: string;
  description: string;
};

const EMPTY_FORM: HeroFormState = {
  image: "",
  imageFile: null,
  imagePreviewDataUrl: "",
  tagline: "",
  title: "",
  description: "",
};

function toFormState(data?: HeroSectionResponse): HeroFormState {
  if (!data) {
    return EMPTY_FORM;
  }

  const image =
    data.image ??
    data.image_url ??
    data.hero_image ??
    data.background_image ??
    "";

  return {
    image,
    imageFile: null,
    imagePreviewDataUrl: "",
    tagline: data.badge_text ?? data.tagline ?? "",
    title: data.headline ?? data.title ?? "",
    description: data.description ?? "",
  };
}

export default function HeroSectionSettings({
  data,
  isLoading,
  isSaving,
  loadError,
  saveError,
  saveSuccess,
  onSave,
}: HeroSectionSettingsProps) {
  const [form, setForm] = useState<HeroFormState>(() => toFormState(data));

  const previewImage = useMemo(() => {
    if (form.imagePreviewDataUrl) {
      return form.imagePreviewDataUrl;
    }

    return form.image.trim();
  }, [form.image, form.imagePreviewDataUrl]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;

    if (!nextFile) {
      setForm((previous) => ({ ...previous, imageFile: null, imagePreviewDataUrl: "" }));
      return;
    }

    const reader = new FileReader();

    const previewDataUrl = await new Promise<string>((resolve) => {
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(nextFile);
    });

    setForm((previous) => ({
      ...previous,
      imageFile: nextFile,
      imagePreviewDataUrl: previewDataUrl,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSave({
      badge_text: form.tagline.trim(),
      headline: form.title.trim(),
      description: form.description.trim(),
      imageFile: form.imageFile,
    });
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Hero Section</h3>
        <p className="mt-1 text-sm text-slate-500">
          Manage the homepage hero image, tag line, title, and description.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Loading hero settings...
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      ) : null}

      {saveError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
      ) : null}

      {saveSuccess ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {saveSuccess}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="space-y-1 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upload Hero Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
              />
            </label>

            {form.imageFile ? (
              <p className="text-xs text-slate-500">
                Selected: <span className="font-medium text-slate-700">{form.imageFile.name}</span>
              </p>
            ) : null}

            <input
              type="text"
              value={form.image}
              onChange={(event) => setForm((previous) => ({ ...previous, image: event.target.value }))}
              placeholder="Current image URL (read from backend)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-300"
              disabled
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
            {previewImage ? (
              <div
                aria-label="Hero preview"
                className="h-36 w-full rounded-md bg-cover bg-center"
                style={{ backgroundImage: `url(${previewImage})` }}
              />
            ) : (
              <div className="flex h-36 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-500">
                Image preview will appear here.
              </div>
            )}
          </div>
        </div>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tag Line</span>
          <input
            type="text"
            value={form.tagline}
            onChange={(event) => setForm((previous) => ({ ...previous, tagline: event.target.value }))}
            placeholder="Your short tag line"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-300"
            required
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Title</span>
          <input
            type="text"
            value={form.title}
            onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
            placeholder="Main hero title"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-300"
            required
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span>
          <textarea
            value={form.description}
            onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
            placeholder="Hero description"
            className="h-28 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-300"
            required
          />
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Hero Section"}
          </button>
        </div>
      </form>
    </section>
  );
}
