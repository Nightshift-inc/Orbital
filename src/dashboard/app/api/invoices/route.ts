import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.ORBITAL_API_URL ?? process.env.NEXT_PUBLIC_ORBITAL_API_URL ?? 'http://localhost:4000';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const upstream = await fetch(`${GATEWAY}/api/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
