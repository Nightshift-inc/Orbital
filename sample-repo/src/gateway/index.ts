import express from 'express';
import cookieParser from 'cookie-parser';
import { router } from './router';
import { stubRoutes } from './stub-routes';

const app = express();
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-gateway' });
});

app.use('/', stubRoutes);
app.use('/', router);

const PORT = Number(process.env.GATEWAY_PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`[api-gateway] listening on :${PORT}`);
});
