"use client";

import React from "react";
import { getStatusMetadata } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const metadata = getStatusMetadata(status);

  return (
    <span
      className={`status ${metadata.pillClass}`}
      title={metadata.description}
      role="status"
    >
      <span className="text-[10px] leading-none" aria-hidden="true">
        ●
      </span>
      <span>{metadata.label}</span>
    </span>
  );
}

