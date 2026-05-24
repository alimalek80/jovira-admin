export type HeroSectionResponse = {
  badge_text?: string;
  tagline?: string;
  title?: string;
  headline?: string;
  description?: string;
  image?: string;
  image_url?: string;
  hero_image?: string;
  background_image?: string;
  search_placeholder?: string;
  search_button_text?: string;
  updated_at?: string;
};

export type HeroSectionPayload = {
  badge_text: string;
  headline: string;
  description: string;
  image?: string;
};

export type HeroSectionUpdateInput = {
  badge_text: string;
  headline: string;
  description: string;
  imageFile?: File | null;
};

async function parseJsonSafe(response: Response) {
  return (await response.json().catch(() => null)) as unknown;
}

function resolveErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const record = payload as { message?: unknown; detail?: unknown };

    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }

    if (typeof record.detail === "string" && record.detail.trim()) {
      return record.detail;
    }
  }

  return fallback;
}

export async function getAdminHeroSection(): Promise<HeroSectionResponse> {
  const response = await fetch("/api/public-site/admin/hero", {
    method: "GET",
    cache: "no-store",
  });

  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    const message = resolveErrorMessage(payload, "Unable to load hero section.");
    throw new Error(message);
  }

  return (payload ?? {}) as HeroSectionResponse;
}

export async function updateAdminHeroSection(payload: HeroSectionUpdateInput): Promise<HeroSectionResponse> {
  const requestOptions: RequestInit = {
    method: "PUT",
  };

  if (payload.imageFile) {
    const formData = new FormData();
    formData.append("badge_text", payload.badge_text);
    formData.append("headline", payload.headline);
    formData.append("description", payload.description);
    formData.append("image", payload.imageFile);
    requestOptions.body = formData;
  } else {
    const jsonPayload: HeroSectionPayload = {
      badge_text: payload.badge_text,
      headline: payload.headline,
      description: payload.description,
    };

    requestOptions.headers = {
      "Content-Type": "application/json",
    };
    requestOptions.body = JSON.stringify(jsonPayload);
  }

  const response = await fetch("/api/public-site/admin/hero", requestOptions);

  const responsePayload = await parseJsonSafe(response);

  if (!response.ok) {
    const message = resolveErrorMessage(responsePayload, "Unable to update hero section.");
    throw new Error(message);
  }

  return (responsePayload ?? {}) as HeroSectionResponse;
}
