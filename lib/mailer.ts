import nodemailer from "nodemailer";

export async function sendMail(to: string, subject: string, html: string) {
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port,
    secure: port === 465, // true for 465, false for 587/STARTTLS
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! }
  });
  await transporter.sendMail({ from: process.env.FROM_EMAIL!, to, subject, html });
}

export function orderEmailTemplate(status: string, data: { id:string; width:number; height:number; amount:number; }): string {
  return `<div style="font-family:system-ui,Segoe UI,Arial">
    <h2>${process.env.NEXT_PUBLIC_BRAND_NAME || "Demi DTF"} — Order ${status}</h2>
    <p>Order <b>${data.id}</b> — ${data.width}" × ${data.height}"</p>
    <p>Total: $${data.amount.toFixed(2)}</p>
  </div>`;
}
