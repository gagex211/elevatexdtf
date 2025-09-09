export const runtime = "nodejs";
import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("session_id");
    if (!id) return NextResponse.json({ error: "missing session_id" }, { status: 400 });

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return NextResponse.json({ error: "missing STRIPE_SECRET_KEY" }, { status: 500 });

    const stripe = new Stripe(key, { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.retrieve(id);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ status: session.payment_status });
    }

    // Optional DB write (won’t crash if Prisma/DB not set yet)
    try {
      const { prisma } = await import("@/lib/prisma");
      const email =
        session.customer_details?.email ||
        (session.customer_email as string) ||
        "unknown@example.com";
      const m = session.metadata || {};
      await prisma.order.upsert({
        where:  { stripeId: session.id },
        update: {},
        create: {
          stripeId: session.id,
          email,
          sheetWidth:  parseFloat((m as any).sheetWIn  || "22"),
          sheetHeight: parseFloat((m as any).sheetHIn  || "60"),
          dpi:         parseInt  ((m as any).dpi       || "300"),
          sqFt:        parseFloat((m as any).sqFt      || "9.17"),
          unitPrice:   parseFloat((m as any).unitPrice || "6"),
          amount:      (session.amount_total || 0) / 100,
          s3Key:       (m as any).s3Key || "",
          status:      "NEW"
        }
      });
    } catch { /* ignore if Prisma/DB not configured */ }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "confirm failed" }, { status: 500 });
  }
}
