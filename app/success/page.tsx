"use client";
import { useEffect, useState } from "react";
export default function Success() {
  const [msg, setMsg] = useState("Confirming your order…");
  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get("session_id");
    if (!id) { setMsg("Missing session ID."); return; }
    fetch(`/api/confirm?session_id=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(d => setMsg(d.ok ? "Order confirmed! Check your email." : (d.status ? `Payment status: ${d.status}` : "Order pending. Refresh soon.")))
      .catch(() => setMsg("Could not confirm yet. Try refresh."));
  }, []);
  return (<div className="p-10 text-center"><h1 className="text-2xl font-bold">Order Received 🎉</h1><p className="text-gray-600">{msg}</p></div>);
}
