// Historical single-note AuraFlow test completed successfully 2026-11-27.
// RETIRED: always fail closed. No CRM API or mutation is performed.
// Future production synchronization must use a separate audited endpoint
// with durable idempotency, controlled authorization, and explicit rollout.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (process.env.VERCEL_ENV !== 'preview') {
    return res.status(404).json({ error: 'Not available' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(423).json({
    error: 'Test write is disabled',
    crm_write: false,
    retired: true
  });
}
