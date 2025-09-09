import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/mailer";

export async function GET(req: NextRequest) {
  try {
    const to = req.nextUrl.searchParams.get("to") || process.env.SMTP_USER!;
    await sendMail(to, "SMTP Test", "<b>It works!</b>");
    return NextResponse.json({ ok: true, to });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "send failed" }, { status: 500 });
  }
}
