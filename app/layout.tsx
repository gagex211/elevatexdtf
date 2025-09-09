export const metadata = { title: process.env.NEXT_PUBLIC_BRAND_NAME || "ElevateX DTF" };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
