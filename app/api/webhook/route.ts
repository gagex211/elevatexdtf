import Stripe from "stripe"; import { NextRequest, NextResponse } from "next/server"; import { prisma } from "@/lib/prisma";
export async function POST(req: NextRequest){
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY!,{ apiVersion:"2024-06-20"});
  const sig=req.headers.get("stripe-signature"); if(!sig) return NextResponse.json({ error:"No signature" }, { status:400 });
  const raw=await req.text(); let event: Stripe.Event;
  try{ event=stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);}catch(e:any){ return NextResponse.json({ error:`Webhook signature failed: ${e.message}` }, { status:400 }); }
  if(event.type==="checkout.session.completed"){
    const session=event.data.object as Stripe.Checkout.Session;
    const email=session.customer_details?.email || (session.customer_email as string) || "unknown@example.com";
    const m=session.metadata||{};
    await prisma.order.upsert({
      where:{ stripeId: session.id },
      update:{},
      create:{
        stripeId: session.id, email,
        sheetWidth: parseFloat((m as any).sheetWIn||"22"),
        sheetHeight: parseFloat((m as any).sheetHIn||"60"),
        dpi: parseInt((m as any).dpi||"300"),
        sqFt: parseFloat((m as any).sqFt||"9.17"),
        unitPrice: parseFloat((m as any).unitPrice||"6"),
        amount: (session.amount_total||0)/100,
        s3Key: (m as any).s3Key || "",
        status: "NEW"
      }
    });
  }
  return NextResponse.json({ received:true });
}
