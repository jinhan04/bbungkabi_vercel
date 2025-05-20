// src/app/result/page.tsx
"use client";

import dynamic from "next/dynamic";

const ResultPage = dynamic(() => import("./ResultPage"), { ssr: false });

export default ResultPage;
