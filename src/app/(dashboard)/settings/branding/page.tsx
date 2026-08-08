"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import axiosInstance from "@/lib/axios";
import { PUBLIC_SITE_ENDPOINTS } from "@/lib/api-endpoints";

type AdminHeroSection = {
  badge_text?: string;
  headline?: string;
  description?: string;
  search_placeholder?: string;
  search_button_text?: string;
  image?: string | null;
  logo?: string | null;
  updated_at?: string;
};

type UploadStatus = {
  type: "success" | "error";
  text: string;
} | null;

function resolveApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;

    if (payload && typeof payload === "object") {
      const record = payload as Record<string, unknown>;
      const detail = record.detail;
      const message = record.message;

      if (typeof detail === "string" && detail.trim()) {
        return detail;
      }

      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export default function SiteBrandingPage() {
  const [heroData, setHeroData] = useState<AdminHeroSection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoStatus, setLogoStatus] = useState<UploadStatus>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageStatus, setImageStatus] = useState<UploadStatus>(null);

  const [badgeText, setBadgeText] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [isSavingText, setIsSavingText] = useState(false);
  const [textStatus, setTextStatus] = useState<UploadStatus>(null);

  useEffect(() => {
    let isMounted = true;

    const loadHero = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        const response = await axiosInstance.get(PUBLIC_SITE_ENDPOINTS.adminHero);

        if (isMounted) {
          const data = response.data as AdminHeroSection;
          setHeroData(data);
          setBadgeText(data.badge_text ?? "");
          setHeadline(data.headline ?? "");
          setDescription(data.description ?? "");
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(resolveApiErrorMessage(error, "Unable to load site branding."));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadHero();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setLogoFile(nextFile);
    setLogoStatus(null);
    setLogoPreview(nextFile ? URL.createObjectURL(nextFile) : null);
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setImageFile(nextFile);
    setImageStatus(null);
    setImagePreview(nextFile ? URL.createObjectURL(nextFile) : null);
  };

  const handleUploadLogo = async () => {
    if (!logoFile) {
      return;
    }

    try {
      setIsUploadingLogo(true);
      setLogoStatus(null);

      const formData = new FormData();
      formData.append("logo", logoFile);

      const response = await axiosInstance.patch(PUBLIC_SITE_ENDPOINTS.adminHero, formData);

      setHeroData(response.data as AdminHeroSection);
      setLogoFile(null);
      setLogoPreview(null);
      setLogoStatus({ type: "success", text: "Logo uploaded successfully." });
    } catch (error) {
      setLogoStatus({ type: "error", text: resolveApiErrorMessage(error, "Unable to upload logo.") });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleUploadImage = async () => {
    if (!imageFile) {
      return;
    }

    try {
      setIsUploadingImage(true);
      setImageStatus(null);

      const formData = new FormData();
      formData.append("image", imageFile);

      const response = await axiosInstance.patch(PUBLIC_SITE_ENDPOINTS.adminHero, formData);

      setHeroData(response.data as AdminHeroSection);
      setImageFile(null);
      setImagePreview(null);
      setImageStatus({ type: "success", text: "Hero image uploaded successfully." });
    } catch (error) {
      setImageStatus({ type: "error", text: resolveApiErrorMessage(error, "Unable to upload hero image.") });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveText = async () => {
    try {
      setIsSavingText(true);
      setTextStatus(null);

      const response = await axiosInstance.patch(PUBLIC_SITE_ENDPOINTS.adminHero, {
        badge_text: badgeText,
        headline,
        description,
      });

      setHeroData(response.data as AdminHeroSection);
      setTextStatus({ type: "success", text: "Hero text content saved successfully." });
    } catch (error) {
      setTextStatus({ type: "error", text: resolveApiErrorMessage(error, "Unable to save hero text content.") });
    } finally {
      setIsSavingText(false);
    }
  };

  const currentLogoUrl = logoPreview ?? heroData?.logo ?? null;
  const currentImageUrl = imagePreview ?? heroData?.image ?? null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Site Branding</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload the logo and hero background image shown on the public Jovira website.
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-gray-400">Loading current branding...</p>
      )}

      {loadError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Logo */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Logo</h2>

          <div className="h-32 flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded">
            {currentLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentLogoUrl} alt="Logo preview" className="max-h-28 max-w-full object-contain" />
            ) : (
              <span className="text-xs text-gray-400">No logo uploaded yet</span>
            )}
          </div>

          <input
            type="file"
            accept="image/*"
            onChange={handleLogoSelect}
            className="w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-gray-200"
          />

          <button
            type="button"
            onClick={handleUploadLogo}
            disabled={!logoFile || isUploadingLogo}
            className="bg-[#0f2347] text-white text-sm px-5 py-2 rounded hover:bg-[#1a3460] disabled:opacity-50"
          >
            {isUploadingLogo ? "Uploading..." : "Upload Logo"}
          </button>

          {logoStatus && (
            <p className={`text-sm ${logoStatus.type === "success" ? "text-green-600" : "text-red-500"}`}>
              {logoStatus.text}
            </p>
          )}
        </div>

        {/* Hero background image */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Hero Background Image
          </h2>

          <div className="h-32 flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded overflow-hidden">
            {currentImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentImageUrl} alt="Hero image preview" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-gray-400">No hero image uploaded yet</span>
            )}
          </div>

          <input
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-gray-200"
          />

          <button
            type="button"
            onClick={handleUploadImage}
            disabled={!imageFile || isUploadingImage}
            className="bg-[#0f2347] text-white text-sm px-5 py-2 rounded hover:bg-[#1a3460] disabled:opacity-50"
          >
            {isUploadingImage ? "Uploading..." : "Upload Hero Image"}
          </button>

          {imageStatus && (
            <p className={`text-sm ${imageStatus.type === "success" ? "text-green-600" : "text-red-500"}`}>
              {imageStatus.text}
            </p>
          )}
        </div>
      </div>

      {/* Hero Text Content */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Hero Text Content
        </h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tag Line</label>
          <input
            type="text"
            value={badgeText}
            onChange={(e) => setBadgeText(e.target.value)}
            placeholder="e.g. TOURISM & TRAVEL AGENCY"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2347]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-xs text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Leave empty to hide title"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2347]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="e.g. EXPLORE. EXPERIENCE. REMEMBER."
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2347]"
          />
        </div>

        <button
          type="button"
          onClick={handleSaveText}
          disabled={isSavingText}
          className="bg-[#0f2347] text-white text-sm px-5 py-2 rounded hover:bg-[#1a3460] disabled:opacity-50"
        >
          {isSavingText ? "Saving..." : "Save Hero Section"}
        </button>

        {textStatus && (
          <p className={`text-sm ${textStatus.type === "success" ? "text-green-600" : "text-red-500"}`}>
            {textStatus.text}
          </p>
        )}
      </div>
    </div>
  );
}
