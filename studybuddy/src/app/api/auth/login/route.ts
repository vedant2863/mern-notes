import { insforgeServer } from "@/lib/insforge-server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const { data, error } = await insforgeServer.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.user) {
      return Response.json({ error: error?.message || "Login failed" }, { status: 401 });
    }

    // Store session in httpOnly cookie so frontend never sees the token
    const cookieStore = await cookies();
    cookieStore.set("session", JSON.stringify({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.profile?.name || data.user.email.split("@")[0],
      },
      accessToken: data.accessToken,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return Response.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.profile?.name || data.user.email.split("@")[0],
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Login failed" },
      { status: 500 }
    );
  }
}
