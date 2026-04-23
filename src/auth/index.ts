import express from 'express';
import cookieParser from 'cookie-parser';
import { authMiddleware } from './middleware';
import { tokenRouter } from './token';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(authMiddleware);
app.use('/token', tokenRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

const PORT = Number(process.env.AUTH_SERVICE_PORT ?? 4001);
app.listen(PORT, () => {
  console.log(`[auth-service] listening on :${PORT}`);
});
