/**
 * Swagger Path Definitions
 * 
 * This file contains OpenAPI path definitions for all API endpoints.
 * These are loaded by swagger-jsdoc to generate the specification.
 */

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Basic health check
 *     description: Returns basic server health status
 *     security: []
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */

/**
 * @swagger
 * /api/health/detailed:
 *   get:
 *     tags: [Health]
 *     summary: Detailed health check
 *     description: Returns detailed server health including memory and database status
 *     security: []
 *     responses:
 *       200:
 *         description: Detailed health information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DetailedHealthResponse'
 */

/**
 * @swagger
 * /api/health/ready:
 *   get:
 *     tags: [Health]
 *     summary: Readiness probe
 *     description: Kubernetes readiness probe - checks if server can handle traffic
 *     security: []
 *     responses:
 *       200:
 *         description: Server is ready
 *       503:
 *         description: Server not ready
 */

/**
 * @swagger
 * /api/health/live:
 *   get:
 *     tags: [Health]
 *     summary: Liveness probe
 *     description: Kubernetes liveness probe - checks if server is alive
 *     security: []
 *     responses:
 *       200:
 *         description: Server is alive
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: User login
 *     description: Authenticate user and receive JWT token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: Invalid email or password
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register new user
 *     description: Create a new user account (Admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User created successfully
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already exists
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users
 *     description: Get all users (Admin only)
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /api/users/password-requirements:
 *   get:
 *     tags: [Users]
 *     summary: Get password requirements
 *     description: Returns password complexity requirements for user creation
 *     security: []
 *     responses:
 *       200:
 *         description: Password requirements
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PasswordRequirements'
 */

/**
 * @swagger
 * /api/users:
 *   post:
 *     tags: [Users]
 *     summary: Create a new user
 *     description: Create a new user account (Admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error (password requirements not met)
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Update a user
 *     description: Update user details (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 description: Leave empty to keep current password
 *               role:
 *                 type: string
 *                 enum: [Admin, User]
 *     responses:
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     tags: [Users]
 *     summary: Delete a user
 *     description: Delete a user account (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /api/audit:
 *   get:
 *     tags: [Audit]
 *     summary: Get audit logs
 *     description: Retrieve audit logs with filtering (Admin only)
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of records to skip
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: Filter by user ID
 *     responses:
 *       200:
 *         description: Audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
 *                 total:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 */

/**
 * @swagger
 * /api/uploads:
 *   get:
 *     tags: [Uploads]
 *     summary: List uploads
 *     description: Get list of uploaded files
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of uploads
 *   post:
 *     tags: [Uploads]
 *     summary: Upload a file
 *     description: Upload an Excel/CSV file for processing
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel or CSV file (.xlsx, .xls, .csv)
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *       400:
 *         description: Invalid file type or validation error
 */

/**
 * @swagger
 * /api/claims:
 *   get:
 *     tags: [Claims]
 *     summary: List claims
 *     description: Get list of claims with filtering and pagination
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by claim status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by patient name, claim number, etc.
 *     responses:
 *       200:
 *         description: List of claims
 */

/**
 * @swagger
 * /api/reimburse/preview:
 *   post:
 *     tags: [Reimburse]
 *     summary: Preview reimbursement upload
 *     description: Preview a reimbursement file before committing
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Preview data
 */

/**
 * @swagger
 * /api/reimburse/commit:
 *   post:
 *     tags: [Reimburse]
 *     summary: Commit reimbursement upload
 *     description: Commit a previewed reimbursement file
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               previewId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reimbursement committed
 */

/**
 * @swagger
 * /api/era/files:
 *   get:
 *     tags: [ERA]
 *     summary: List ERA files
 *     description: Get list of uploaded ERA PDF files
 *     responses:
 *       200:
 *         description: List of ERA files
 *   post:
 *     tags: [ERA]
 *     summary: Upload ERA PDFs
 *     description: Upload ERA PDF files for parsing
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               eraPdfs:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: ERA PDF files (max 10)
 *     responses:
 *       200:
 *         description: ERA files uploaded
 */

/**
 * @swagger
 * /api/era/era-files/{id}/auto-parse:
 *   post:
 *     tags: [ERA]
 *     summary: Auto-parse ERA file
 *     description: Automatically parse an ERA PDF and extract payment data
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ERA file ID
 *     responses:
 *       200:
 *         description: ERA file parsed successfully
 *       404:
 *         description: ERA file not found
 */

export {};
