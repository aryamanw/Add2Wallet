// app/api/passes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { passDataSchema } from "@/lib/passSchema";
import { buildPass } from "@/lib/buildPass";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = passDataSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid pass data", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const pkpass = await buildPass(parsed.data);
    return new NextResponse(new Uint8Array(pkpass), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${parsed.data.title.replace(/[^a-z0-9]/gi, "_")}.pkpass"`,
      },
    });
  } catch (err) {
    console.error("Failed to build pass:", err);
    return NextResponse.json(
      { error: "Failed to generate pass. Check server certificate configuration." },
      { status: 500 }
    );
  }
}
