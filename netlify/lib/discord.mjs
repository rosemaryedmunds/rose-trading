// Shared Discord REST helpers (bot token auth).
const API = "https://discord.com/api/v10";

const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var ${k}`);
  return v;
};

async function discordBot(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}`,
      "Content-Type": "application/json",
      "X-Audit-Log-Reason": "Stripe subscription sync",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

/** Add the user to the server using their OAuth access token (guilds.join scope). */
export async function joinGuild(userId, accessToken) {
  const res = await discordBot("PUT", `/guilds/${env("DISCORD_GUILD_ID")}/members/${userId}`, {
    access_token: accessToken,
  });
  // 201 = added, 204 = already a member
  if (![201, 204].includes(res.status)) {
    console.error("joinGuild failed", res.status, await res.text());
  }
}

export async function addMemberRole(userId) {
  const res = await discordBot(
    "PUT",
    `/guilds/${env("DISCORD_GUILD_ID")}/members/${userId}/roles/${env("DISCORD_MEMBER_ROLE_ID")}`
  );
  if (res.status !== 204) throw new Error(`addRole ${res.status}: ${await res.text()}`);
  console.log(`Role added to ${userId}`);
}

export async function removeMemberRole(userId) {
  const res = await discordBot(
    "DELETE",
    `/guilds/${env("DISCORD_GUILD_ID")}/members/${userId}/roles/${env("DISCORD_MEMBER_ROLE_ID")}`
  );
  // 404 = user already left the server, nothing to do
  if (![204, 404].includes(res.status)) throw new Error(`removeRole ${res.status}: ${await res.text()}`);
  console.log(`Role removed from ${userId}`);
}

export { env };
