// AdBanner.tsx
"use client";
import { useEffect } from "react";

// 👉 여기에 선언 추가
declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export default function AdBanner() {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error("AdSense error", e);
    }
  }, []);

  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client="ca-pub-2686153786786413"
      data-ad-slot="5803943844"
      data-ad-format="auto"
      data-full-width-responsive="true"
    ></ins>
  );
}
