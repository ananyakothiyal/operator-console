// api/verify-passcode.js
// Checks a submitted passcode against ACCESS_PASSCODE (set in Vercel's
// environment variables). If ACCESS_PASSCODE isn't set at all, the app is
// intentionally open — this endpoint always succeeds so the gate doesn't
// block anyone by accident.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.ACCESS_PASSCODE) {
    return res.status(200).json({ ok: true, gated: false });
  }

  const { passcode } = req.body || {};
  if (passcode === process.env.ACCESS_PASSCODE) {
    return res.status(200).json({ ok: true, gated: true });
  }

  return res.status(401).json({ ok: false, error: "Incorrect access code." });
}
