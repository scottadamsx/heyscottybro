#!/usr/bin/env node
/**
 * One-time helper to mint a Gmail refresh token for the AI Inbox poller.
 *
 * Prereqs (Google Cloud Console, once):
 *   1. Create/choose a project → enable the "Gmail API".
 *   2. APIs & Services → Credentials → Create Credentials → OAuth client ID.
 *        Application type: "Web application".
 *        Authorized redirect URI: http://localhost:5599/oauth2callback
 *   3. OAuth consent screen → add your Google account as a Test user.
 *
 * Run:
 *   GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy node scripts/gmail-auth.mjs
 *
 * It opens (prints) an auth URL, you approve in the browser, and it prints the
 * GMAIL_REFRESH_TOKEN to paste into Vercel + .env. Read-only Gmail scope.
 */
import http from "node:http";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = 5599;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;
// modify = poll the inbox + mark messages read (remove UNREAD label);
// send = reply on Scott's behalf.
const SCOPE = "https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars first.");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // force a refresh_token even on re-auth
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("No code in callback.");
    return;
  }
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT,
        grant_type: "authorization_code",
      }),
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok || !data.refresh_token) {
      res.writeHead(500).end("Token exchange failed — see terminal.");
      console.error("\nToken exchange failed:", data);
      console.error("(If there's no refresh_token, revoke prior access at https://myaccount.google.com/permissions and retry.)");
    } else {
      res.writeHead(200, { "Content-Type": "text/html" }).end(
        "<h2>Done — copy the refresh token from your terminal. You can close this tab.</h2>"
      );
      console.log("\n✅ GMAIL_REFRESH_TOKEN=" + data.refresh_token + "\n");
      console.log("Add this (plus GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) to Vercel env vars and .env.\n");
    }
  } catch (err) {
    res.writeHead(500).end("Error — see terminal.");
    console.error(err);
  } finally {
    setTimeout(() => server.close(() => process.exit(0)), 500);
  }
});

server.listen(PORT, () => {
  console.log("\n1. Open this URL in your browser and approve access:\n");
  console.log("   " + authUrl + "\n");
  console.log(`2. Waiting for the redirect to ${REDIRECT} ...\n`);
});
