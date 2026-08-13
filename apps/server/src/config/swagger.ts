import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'Deltaora API',
      version: '1.0.0',
      description: 'API documentation for the Deltaora Website Monitoring Platform.',
      contact: {
        name: 'API Support',
        url: 'https://deltaora.com/support',
        email: 'support@deltaora.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}/api/v1`,
        description: 'Local Development Server',
      },
      {
        url: 'https://api.deltaora.com/api/v1',
        description: 'Production Server',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: env.NODE_ENV === 'production' ? '__Host-deltaora-access' : 'deltaora.accessToken',
          description: 'Access token stored in an HTTP-only cookie.',
        },
        csrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'x-csrf-token',
          description: 'Signed CSRF token returned by GET /auth/csrf and mirrored from the CSRF cookie.',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            details: {
              type: 'array',
              description: 'Optional validation details',
              items: {
                type: 'object',
              },
            },
          },
        },
      },
    },
    security: [
      {
        cookieAuth: [],
        csrfToken: [],
      },
    ],
  },
  // Automatically parse JSDoc comments in route and controller files
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
