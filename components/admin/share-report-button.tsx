"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Loader2 } from "lucide-react";
import { toBlob } from "html-to-image";

export function ShareReportButton({ targetId }: { targetId: string }) {
  const [isGenerating, setIsGenerating] = useState(false);

  // Helper function for the fallback download
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); // Required for Firefox
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const element = document.getElementById(targetId);
    
    if (!element) {
      alert("Could not find the report to capture.");
      return;
    }

    try {
      setIsGenerating(true);
      
      // 1. Capture the DOM element natively using html-to-image
      const blob = await toBlob(element, { 
        backgroundColor: "#f9fafb", // Match your page background
        pixelRatio: 2, // High resolution (equivalent to scale: 2)
      });

      if (!blob) throw new Error("Failed to create image file.");

      const filename = `Performance_Report_${Date.now()}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      // 2. Try Native Web Share API
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: "Telecaller Performance Report",
            files: [file]
          });
        } catch (shareError: any) {
          // If the user manually aborted (closed the share menu), do nothing.
          if (shareError.name === "AbortError") return;
          
          // If the browser blocked it due to timeout, fallback to download
          console.warn("Share API failed or was blocked, falling back to download:", shareError);
          triggerDownload(blob, filename);
        }
      } else {
        // Share API not supported on this device/browser, fallback immediately
        triggerDownload(blob, filename);
      }

    } catch (error) {
      console.error("Failed to generate report image:", error);
      alert("Failed to capture the screenshot. Check console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button variant="default" onClick={handleShare} disabled={isGenerating} className="gap-2">
      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
      {isGenerating ? "Capturing..." : "Share Report"}
    </Button>
  );
}
