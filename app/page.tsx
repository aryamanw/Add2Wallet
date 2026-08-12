// app/page.tsx
"use client";

import { useState } from "react";
import UploadForm from "@/components/UploadForm";
import ReviewForm from "@/components/ReviewForm";
import type { PassData } from "@/lib/passSchema";

type Screen = { name: "upload" } | { name: "review"; passData: PassData };

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>({ name: "upload" });

  if (screen.name === "review") {
    return (
      <ReviewForm
        initialPassData={screen.passData}
        onBack={() => setScreen({ name: "upload" })}
      />
    );
  }

  return (
    <UploadForm
      onExtracted={(passData) => setScreen({ name: "review", passData })}
    />
  );
}
