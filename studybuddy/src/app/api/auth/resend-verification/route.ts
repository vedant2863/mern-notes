import { insforgeServer } from "@/lib/insforge-server";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const { data, error } = await insforgeServer.auth.resendVerificationEmail({
      email,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ data });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to resend" },
      { status: 500 }
    );
  }
}
