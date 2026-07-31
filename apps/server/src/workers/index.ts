import './crawl.worker';
import './summary.worker';
import './notification.worker';
import { startScheduler } from './scheduler';

export const initializeWorkers = () => {
  console.log('Initializing BullMQ workers...');
  startScheduler();
};
