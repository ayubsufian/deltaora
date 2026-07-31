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
import { initializeWorkers } from './workers';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: env.NODE_ENV === 'production' ? 'https://deltaora.com' : 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/v1', routes);

// Error Handling
app.use(errorHandler);

// Start Server
const startServer = async () => {
  await connectDB();
  initializeWorkers();
  
  app.listen(env.PORT, () => {
    console.log(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  });
};

startServer();
