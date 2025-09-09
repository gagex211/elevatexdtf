import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
export async function POST(req: NextRequest){
  const { filename, contentType } = await req.json();
  const Bucket = process.env.AWS_S3_BUCKET!;
  const Region = process.env.AWS_REGION!;
  const Key    = `uploads/${Date.now()}-${filename}`;
  const s3 = new S3Client({ region: Region, credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! } });
  const command = new PutObjectCommand({ Bucket, Key, ContentType: contentType });
  const url = await getSignedUrl(s3, command, { expiresIn: 300 });
  return NextResponse.json({ url, key: Key, bucket: Bucket, region: Region });
}
