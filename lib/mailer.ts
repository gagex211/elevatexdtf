import nodemailer from "nodemailer";

export async function sendMail(to: string, subject: string, html: string) {
  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER!;
  const pass = process.env.SMTP_PASS!;
  const from = process.env.FROM_EMAIL!;

  if (!host || !port || !user || !pass || !from) {
    throw new Error("Missing SMTP env vars (SMTP_HOST/PORT/USER/PASS or FROM_EMAIL)");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,            // false for 587, true for 465
    requireTLS: port === 587,        // force STARTTLS on 587
    auth: { user, pass },
    logger: true,                    // log to server console (dev only)
    debug: true
  });

  try {
    await transporter.verify();      // proactively test auth/connection
    await transporter.sendMail({ from, to, subject, html });
  } catch (err: any) {
    // surface the real reason to the API route
    const msg = err?.response || err?.message || String(err);
    throw new Error("SMTP send failed: " + msg);
  }
}

export function orderEmailTemplate(status: string, data: { id:string; width:number; height:number; amount:number; }): string {
  return `<div style="font-family:system-ui,Segoe UI,Arial">
    <h2>${process.env.NEXT_PUBLIC_BRAND_NAME || "ElevateX DTF"} — Order ${status}</h2>
    <p>Order <b>${data.id}</b> — ${data.width}" × ${data.height}"</p>
    <p>Total: $${data.amount.toFixed(2)}</p>
  </div>`;
}
