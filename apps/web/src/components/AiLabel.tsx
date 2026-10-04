import { IconSparkles } from "@proven/ui";

/** Required on every AI output (FR-09): it is a draft, not a fact. */
export function AiLabel({ model }: { model?: string }) {
  return (
    <p className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-200">
      <IconSparkles className="h-3.5 w-3.5" />
      AI-generated — periksa sebelum dipakai{model && model !== "mock" ? ` · ${model}` : ""}
    </p>
  );
}
