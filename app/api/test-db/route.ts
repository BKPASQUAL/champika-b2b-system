import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/payments?select=*&limit=1', {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    }
  });
  if (!res.ok) return NextResponse.json({ error: "Failed to fetch" }, { status: res.status });
  
  // Use a HEAD request or OPTIONS to get columns, but PostgREST exposes OpenAPI spec:
  const openApiRes = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/', {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    }
  });
  const openApi = await openApiRes.json();
  const columns = openApi.definitions?.payments?.properties ? Object.keys(openApi.definitions.payments.properties) : [];
  return NextResponse.json({ columns });
}
