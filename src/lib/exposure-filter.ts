import type { Json } from "@/integrations/supabase/types";

type SourceWithExposureFilter = {
  metadata?: Json | null;
};

function asRecord(value: Json | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function getExposureFilter(source?: SourceWithExposureFilter | null) {
  const metadata = asRecord(source?.metadata);
  const exposureFilter = asRecord(metadata.exposure_filter as Json | undefined);
  const mode = exposureFilter.mode === "applied" || exposureFilter.mode === "excluded" ? exposureFilter.mode : "none";
  const exposure = typeof exposureFilter.exposure === "string" ? exposureFilter.exposure : "all";
  const dataReady = exposureFilter.data_ready === true;

  return { mode, exposure, dataReady };
}

export function shouldExposeCollectedProduct(source?: SourceWithExposureFilter | null) {
  const filter = getExposureFilter(source);
  if (filter.mode !== "applied") return true;
  if (!filter.dataReady) return true;
  return filter.exposure === "all" || filter.exposure === "auto" || filter.exposure === "watch";
}
