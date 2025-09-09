import Stripe from "stripe"; import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest){
  const body=await req.json();
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY!,{ apiVersion:"2024-06-20"});
  const unitPrice=Math.max(0, Math.round((Number(process.env.NEXT_PUBLIC_PRICE_PER_SQFT||body.unitPrice||6)*100)));
  const amount=Math.max(100, Math.round(body.sqFt*unitPrice));
  const session=await stripe.checkout.sessions.create({
    mode:"payment",
    payment_method_types:["card"],
    line_items:[{ price_data:{ currency:"usd", product_data:{ name:`DTF Gang Sheet ${body.sheetWIn}×${body.sheetHIn} in` }, unit_amount: amount }, quantity:1 }],
    success_url: process.env.STRIPE_SUCCESS_URL!,
    cancel_url: process.env.STRIPE_CANCEL_URL!,
    metadata:{ sheetWIn:String(body.sheetWIn), sheetHIn:String(body.sheetHIn), dpi:String(body.dpi), sqFt:String(body.sqFt), unitPrice:String(unitPrice/100), s3Key:String(body.s3Key||"") }
  });
  return NextResponse.json({ id: session.id, url: session.url });
}
