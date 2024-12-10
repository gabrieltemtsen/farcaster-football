"use client";

import dynamic from "next/dynamic";

const Index = dynamic(() => import("@/components/Home"), {
  ssr: false,
});

export default function App() {
  return (
    <main className="min-h-screen flex flex-col p-4">
      <Index />
    </main>
  );
}