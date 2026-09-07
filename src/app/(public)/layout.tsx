import React from "react";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {children}
      </div>
    </div>
  );
}
