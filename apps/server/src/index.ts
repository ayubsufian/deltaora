import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { connectDB } from './config/db';
import './config/redis'; // Initialize Redis

import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { csrfProtection } from './middleware/csrf';
import { initializeWorkers } from './workers';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { isEmailDeliveryError, validateEmailProvider } from './services/email.service';

const app = express();

if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
app.use(helmet());
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api/v1', csrfProtection);

// API Documentation (Swagger)
if (env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'Deltaora API Documentation',
  }));
}

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/v1', routes);

// Error Handling
app.use(errorHandler);

// Start Server
const startServer = async () => {
  await validateEmailProvider();
  await connectDB();
  initializeWorkers();
  
  const server = app.listen(env.PORT, () => {
    console.log(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  });

  // Graceful shutdown (2026 container orchestration standard)
  const shutdown = async (signal: string) => {
    console.log(`${signal} received. Graceful shutdown initiated...`);
    server.close(() => {
      console.log('HTTP server closed.');
    });
    try {
      const mongoose = await import('mongoose');
      await mongoose.default.disconnect();
      console.log('MongoDB disconnected.');
    } catch (err) {
      console.error('Error during MongoDB disconnect:', err);
    }
    try {
      const { redis } = await import('./config/redis');
      await redis.quit();
      console.log('Redis disconnected.');
    } catch (err) {
      console.error('Error during Redis disconnect:', err);
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((error) => {
  if (isEmailDeliveryError(error)) {
    console.error(`Startup failed: ${error.message} (${error.code})`);
  } else {
    console.error('Startup failed:', error);
  }
  process.exit(1);
});
