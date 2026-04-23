import { Router } from 'express';

export const tokenRouter = Router();

interface ValidateBody {
  token?: string;
}

tokenRouter.post('/validate', (req, res) => {
  const { token } = req.body as ValidateBody;
  if (!token) {
    res.status(400).json({ valid: false, reason: 'missing_token' });
    return;
  }

  // Line 17: upstream error propagates through this handler when the
  const parts = token.split('.');              // middleware hands it a bad token.
  if (parts.length < 2) {
    res.status(400).json({ valid: false, reason: 'malformed_token' });
    return;
  }

  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  res.json({
    valid: true,
    subject: payload.sub,
    expires_at: payload.exp,
  });
});
