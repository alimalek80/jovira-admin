"use client";

import { useMemo, useState } from "react";
import HeroSectionSettings from "@/components/web-sections/hero-section-settings";
import { useAdminHeroSection, useUpdateAdminHeroSection } from "@/hooks/use-public-site-settings";

type SectionDefinition = {
  id: string;
  title: string;
  description: string;
  status: "ready" | "coming-soon";
};

const sections: SectionDefinition[] = [
  {
    id: "hero",
    title: "Hero Section",
    description: "Image, tag line, title, and description",
    status: "ready",
  },
  {
    id: "featured-destinations",
    title: "Featured Destinations",
    description: "Prepare this section for future settings",
    status: "coming-soon",
  },
  {
    id: "testimonials",
    title: "Testimonials",
    description: "Prepare this section for future settings",
    status: "coming-soon",
  },
];

export default function WebSectionsPage() {
  const [activeSectionId, setActiveSectionId] = useState<string>("hero");
  const [toast, setToast] = useState("");

  const heroQuery = useAdminHeroSection();
  const updateHeroMutation = useUpdateAdminHeroSection({
    onSuccess: () => {
      setToast("Hero section updated successfully.");
    },
  });

  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId) ?? sections[0],
    [activeSectionId]
  );

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Web Sections</h2>
        <p className="mt-1 text-sm text-slate-600">
          Central place to manage content blocks for the public Jovira website.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sections</p>
          <ul className="space-y-1">
            {sections.map((section) => {
              const active = section.id === activeSection.id;

              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => setActiveSectionId(section.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left transition ${
                      active
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-semibold">{section.title}</p>
                    <p className={`mt-0.5 text-xs ${active ? "text-slate-200" : "text-slate-500"}`}>
                      {section.description}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {toast ? (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {toast}
            </div>
          ) : null}

          {activeSection.id === "hero" ? (
            <HeroSectionSettings
              key={JSON.stringify(heroQuery.data ?? {})}
              data={heroQuery.data}
              isLoading={heroQuery.isLoading}
              isSaving={updateHeroMutation.isPending}
              loadError={heroQuery.error instanceof Error ? heroQuery.error.message : undefined}
              saveError={updateHeroMutation.error instanceof Error ? updateHeroMutation.error.message : undefined}
              saveSuccess={toast}
              onSave={async (payload) => {
                setToast("");
                await updateHeroMutation.mutateAsync(payload);
              }}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-slate-700">{activeSection.title}</p>
              <p className="mt-1 text-sm text-slate-500">
                This section scaffold is ready. Add fields and API wiring when backend endpoints are available.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
