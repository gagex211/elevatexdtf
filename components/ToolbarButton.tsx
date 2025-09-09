import React from "react";
export default function ToolbarButton({ onClick, title, children }: { onClick: ()=>void; title?: string; children: React.ReactNode }) {
  return <button title={title} onClick={onClick} className="px-3 py-2 rounded-2xl border border-gray-300 shadow-sm hover:shadow transition text-sm bg-white">{children}</button>;
}
