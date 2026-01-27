/**
 * Swagger/OpenAPI Configuration for RCM Portal API
 * 
 * This file sets up Swagger UI for API documentation.
 * Access at: /api-docs
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RCM Portal API',
      version: '1.0.0',
      description: `
## Overview
RCM Portal API for managing medical claims, reimbursements, and billing workflows.

## Authentication
Most endpoints require a JWT Bearer token. Obtain a token by logging in via \`/api/auth/login\`.

Include the token in requests:
\`\`\`
Authorization: Bearer <your-token>
\`\`\`

## Rate Limiting
API requests are limited to 100 requests per 15 minutes per IP address.

## Error Responses
All errors follow this format:
\`\`\`json
{
  "error": "Error message",
  "requestId": "abc123"
}
\`\`\`
      `,
      contact: {
        name: 'HBox AI Support',
        email: 'support@hbox.ai',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
      {
        url: 'https://api.rcmportal.hbox.ai',
        description: 'Production server',
      },
    ],
    tags: [
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Users', description: 'User management endpoints' },
      { name: 'Claims', description: 'Claims management endpoints' },
      { name: 'Uploads', description: 'File upload endpoints' },
      { name: 'Reimburse', description: 'Reimbursement management' },
      { name: 'ERA', description: 'Electronic Remittance Advice processing' },
      { name: 'Audit', description: 'Audit log endpoints' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error message' },
            requestId: { type: 'string', description: 'Request ID for tracking' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'User ID' },
            username: { type: 'string', description: 'Username' },
            email: { type: 'string', format: 'email', description: 'Email address' },
            role: { type: 'string', enum: ['Admin', 'User'], description: 'User role' },
            created_at: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            password: { type: 'string', format: 'password', example: 'StrongPass@123' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'JWT access token' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        PasswordRequirements: {
          type: 'object',
          properties: {
            minLength: { type: 'integer', example: 8 },
            requireUppercase: { type: 'boolean', example: true },
            requireLowercase: { type: 'boolean', example: true },
            requireNumbers: { type: 'boolean', example: true },
            requireSpecialChars: { type: 'boolean', example: true },
            specialChars: { type: 'string', example: '!@#$%^&*()_+-=[]{}|;:,.<>?' },
          },
        },
        CreateUserRequest: {
          type: 'object',
          required: ['username', 'email', 'password', 'role'],
          properties: {
            username: { type: 'string', example: 'johndoe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            password: { type: 'string', format: 'password', example: 'StrongPass@123' },
            role: { type: 'string', enum: ['Admin', 'User'], example: 'User' },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number', description: 'Server uptime in seconds' },
          },
        },
        DetailedHealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number' },
            version: { type: 'string' },
            environment: { type: 'string' },
            memory: {
              type: 'object',
              properties: {
                heapUsed: { type: 'string' },
                heapTotal: { type: 'string' },
                rss: { type: 'string' },
              },
            },
            database: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                responseTime: { type: 'string' },
              },
            },
          },
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            action: { type: 'string', description: 'Action performed' },
            user_id: { type: 'integer', description: 'User who performed the action' },
            user_email: { type: 'string' },
            target_user_id: { type: 'integer', nullable: true },
            ip_address: { type: 'string' },
            details: { type: 'object' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'No token provided' },
            },
          },
        },
        Forbidden: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Admin access required' },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Resource not found' },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    './src/routes/*.ts',
    './src/config/swagger-paths.ts',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

/**
 * Setup Swagger UI middleware
 */
export function setupSwagger(app: Express): void {
  // Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'RCM Portal API Documentation',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
      },
    })
  );

  // JSON spec endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

export default swaggerSpec;
