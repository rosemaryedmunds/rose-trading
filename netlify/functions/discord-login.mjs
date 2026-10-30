// Step 1: "Join" button links here. Sends the user to Discord to log in.
import crypto from "node:crypto";
import { env } from "../lib/discord.mjs";

export default async (req, context) => {
  const state = crypto.randomBytes(16).toString("hex");

  // CSRF protection: remember the state in a short-lived cookie
  context.cookies.set({
    name: "discord_oauth_state",
    value: state,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: env("DISCORD_CLIENT_ID"),
    redirect_uri: `${env("SITE_URL")}/api/discord/callback`,
    response_type: "code",
    scope: "identify guilds.join",
    state,
    prompt: "none",
  });

  return Response.redirect(`https://discord.com/oauth2/authorize?${params}`, 302);
};

export const config = { path: "/api/discord/login" };
