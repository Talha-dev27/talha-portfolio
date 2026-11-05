import nodemailer from "nodemailer";

const allowedOrigin = process.env.ALLOWED_ORIGIN;

export default async function handler(req, res) {
  const origin = req.headers.origin;

  if (origin !== allowedOrigin) {
    return res.status(403).json({ error: "Forbidden origin" });
  }

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { sender, email, focus, message, website } = req.body || {};

  // Basic bot trap: keep this field hidden in the frontend.
  if (website) return res.status(200).json({ ok: true });

  if (
    !sender || !email || !focus || !message ||
    sender.length > 90 || email.length > 180 || message.length > 2500
  ) {
    return res.status(400).json({ error: "Please complete all fields." });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  await transporter.sendMail({
    from: `"Talha Portfolio" <${process.env.GMAIL_USER}>`,
    to: process.env.CONTACT_TO,
    replyTo: email,
    subject: `Portfolio enquiry · ${focus}`,
    text: `Name: ${sender}\nEmail: ${email}\nFocus: ${focus}\n\n${message}`
  });

  return res.status(200).json({ ok: true });
}
