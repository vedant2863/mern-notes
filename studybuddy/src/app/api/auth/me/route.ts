import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie?.value) {
    return Response.json({ user: null });
  }

  try {
    const session = JSON.parse(sessionCookie.value);
    return Response.json({ user: session.user });
  } catch {
    return Response.json({ user: null });
  }
}
