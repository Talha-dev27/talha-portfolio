// Vercel serverless function: POST /api/contact  (ESM — matches "type": "module" in package.json)
import nodemailer from "nodemailer";

const hits = new Map(); // best-effort per-instance rate limit
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 5;
const FOCUS = ["Web development", "App development", "Branding", "Automation", "Email marketing", "Something else"];

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_HITS) return res.status(429).json({ ok: false, error: "Too many requests. Try again later." });
  recent.push(now);
  hits.set(ip, recent);

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body || "{}"); } catch { body = {}; }
  }
  const { name = "", email = "", focus = "", details = "", website = "" } = body || {};

  if (website) return res.status(200).json({ ok: true }); // honeypot: silently drop bots

  const n = String(name).trim();
  const e = String(email).trim();
  const f = String(focus).trim();
  const d = String(details).trim();

  if (n.length < 2 || n.length > 100) return res.status(400).json({ ok: false, error: "Enter your name." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || e.length > 200) return res.status(400).json({ ok: false, error: "Enter a valid email." });
  if (f && !FOCUS.includes(f)) return res.status(400).json({ ok: false, error: "Invalid project focus." });
  if (d.length < 10 || d.length > 5000) return res.status(400).json({ ok: false, error: "Project details must be 10–5000 characters." });

  const { GMAIL_USER, GMAIL_APP_PASSWORD, CONTACT_TO } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return res.status(500).json({ ok: false, error: "Mail server not configured." });

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  try {
    await transporter.sendMail({
      from: `"Portfolio Contact" <${GMAIL_USER}>`,
      to: CONTACT_TO || GMAIL_USER,
      replyTo: `"${n.replace(/["\r\n]/g, "")}" <${e}>`,
      subject: `Portfolio inquiry: ${f || "General"} — ${n.replace(/[\r\n]/g, "")}`,
      text: `Name: ${n}\nEmail: ${e}\nFocus: ${f || "-"}\n\n${d}`,
      html: `<p><b>Name:</b> ${esc(n)}<br><b>Email:</b> ${esc(e)}<br><b>Focus:</b> ${esc(f || "-")}</p><p>${esc(d).replace(/\n/g, "<br>")}</p>`,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("SMTP error:", err && err.message);
    return res.status(502).json({ ok: false, error: "Could not send. Try again later." });
  }
}
