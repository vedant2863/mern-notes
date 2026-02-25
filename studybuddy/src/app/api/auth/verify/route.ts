import { insforgeServer } from "@/lib/insforge-server";

export async function POST(request: Request) {
  const { email, code } = await request.json();

  if (!email || !code) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const { data, error } = await insforgeServer.auth.verifyEmail({
      email,
      otp: code,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ data });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 500 }
    );
  }
}
