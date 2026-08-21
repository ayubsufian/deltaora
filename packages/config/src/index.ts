export const APP_CONFIG = {
  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,

  // Checking intervals (in minutes)
  MIN_CHECK_INTERVAL: 5,
  DEFAULT_CHECK_INTERVAL: 60,
  MAX_CHECK_INTERVAL: 10080, // 1 week

  // Auth limits
  PASSWORD_MIN_LENGTH: 15,
  PASSWORD_MAX_LENGTH: 1024,
  MIN_CHECK_INTERVAL: 5,
  MAX_CHECK_INTERVAL: 10080,
  DEFAULT_CHECK_INTERVAL: 60,
  SESSION_TTL: 7 * 24 * 60 * 60, // 7 days in seconds
  ACCESS_TOKEN_TTL: '15m',
  
  // Rate limits
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
  RATE_LIMIT_MAX: 100, // 100 requests per minute
  
  // Redis TTLs
  DASHBOARD_CACHE_TTL: 600, // 10 minutes
  SEARCH_CACHE_TTL: 300, // 5 minutes
  
  // API
  API_PREFIX: '/api/v1',
};
