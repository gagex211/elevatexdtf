import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/mailer";
export async function POST(req: NextRequest){
  const { to } = await req.json();
  await sendMail(to, "SMTP test from ElevateX DTF", "<b>It works.</b>");
  return NextResponse.json({ ok:true });
}
