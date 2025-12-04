# KYC Module Backend

A KYC (Know Your Customer) module for identity verification and document submission. Handles KYC submissions, status tracking, and admin verification.

## Features

- KYC submission with ID information and document uploads
- Status tracking (none, submitted, verified)
- Admin verification endpoints
- File upload handling with multer
- Database transaction safety

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run migrations to create KYC tables and add admin field:
```bash
# Run KYC migrations
psql -d auth_db -f src/migrations/001_create_kyc_tables.sql
psql -d auth_db -f src/migrations/002_add_admin_to_users.sql
```

3. Configure environment variables (optional, defaults provided):
```bash
# .env file
DB_HOST=localhost
DB_PORT=5432
DB_NAME=auth_db
DB_USER=postgres
DB_PASSWORD=postgres
KYC_PORT=3005
```

4. Create uploads directory (optional, will be created automatically):
```bash
mkdir -p uploads/kyc
```

5. Start the server:
```bash
npm start
```

## API Endpoints

### POST /kyc/submit

Submit KYC information and upload ID document.

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**
- `full_name` (text) - Full name
- `date_of_birth` (text) - Date of birth in format YYYY-MM-DD
- `id_number` (text) - ID document number
- `id_type` (text) - Type of ID: 'passport', 'drivers_license', or 'national_id'
- `id_document` (file) - ID document file (JPEG, PNG, or PDF, max 10MB)

**Response:**
```json
{
  "submission_id": "uuid",
  "status": "submitted",
  "message": "KYC submitted successfully"
}
```

**Error Responses:**
- `400` - Missing required fields, invalid date format, invalid id_type, or missing file
- `401` - Authentication required

### GET /kyc/status

Get current user's KYC status and latest submission information.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "kyc_status": "submitted",
  "submission": {
    "id": "uuid",
    "full_name": "John Doe",
    "id_type": "passport",
    "status": "submitted",
    "submitted_at": "2024-01-01T00:00:00.000Z",
    "verified_at": null
  }
}
```

If no submission exists:
```json
{
  "kyc_status": "none"
}
```

**Error Responses:**
- `401` - Authentication required

### POST /kyc/admin/verify/:user_id

Admin endpoint to verify or reject a KYC submission.

**Headers:**
```
Authorization: Bearer <jwt-token> (admin user)
```

**Request Body:**
```json
{
  "status": "verified"
}
```

Or to reject:
```json
{
  "status": "rejected"
}
```

**Response:**
```json
{
  "success": true,
  "user_id": "uuid",
  "kyc_status": "verified",
  "message": "KYC verified successfully"
}
```

**Error Responses:**
- `400` - Invalid status
- `401` - Authentication required
- `403` - Admin access required
- `404` - No KYC submission found for user

## Database Schema

### kyc_submissions table
- `id` UUID PRIMARY KEY
- `user_id` UUID NOT NULL (references users.id)
- `full_name` VARCHAR(255) NOT NULL
- `date_of_birth` DATE NOT NULL
- `id_number` VARCHAR(255) NOT NULL
- `id_type` VARCHAR(50) NOT NULL
- `id_document_path` VARCHAR(500)
- `status` VARCHAR(20) DEFAULT 'submitted' ('submitted', 'verified', 'rejected')
- `submitted_at` TIMESTAMP DEFAULT NOW()
- `verified_at` TIMESTAMP
- `verified_by` UUID (references users.id, admin who verified)

### users table (updated)
- `is_admin` BOOLEAN DEFAULT FALSE (added by migration)

## File Uploads

- Files are stored in `uploads/kyc/{user_id}/` directory
- Filenames are generated as: `{timestamp}_{originalname}`
- Supported formats: JPEG, PNG, PDF
- Maximum file size: 10MB
- Files are automatically cleaned up if submission validation fails

## Testing

Run tests:
```bash
npm test
```

Tests include:
- KYC submission with file upload
- Status checking
- Admin verification (verify and reject)
- Non-admin access restrictions
- Input validation
- Error handling

## Integration

This module integrates with:

- **Auth Module**: Uses `authenticateToken` middleware
- **Database**: Same PostgreSQL instance, shared connection pool pattern
- **Users Table**: Updates `kyc_status` and uses `is_admin` field

## Admin Setup

To create an admin user, update the users table:
```sql
UPDATE users SET is_admin = TRUE WHERE email = 'admin@example.com';
```

## Security

- All operations use database transactions
- File uploads validated for type and size
- Admin endpoints restricted to admin users only
- Sensitive document paths not exposed in API responses
- Authentication required for all user endpoints

## Example Usage

### Submit KYC

```bash
curl -X POST http://localhost:3005/kyc/submit \
  -H "Authorization: Bearer <token>" \
  -F "full_name=John Doe" \
  -F "date_of_birth=1990-01-15" \
  -F "id_number=ID123456" \
  -F "id_type=passport" \
  -F "id_document=@/path/to/document.pdf"
```

### Get Status

```bash
curl -X GET http://localhost:3005/kyc/status \
  -H "Authorization: Bearer <token>"
```

### Admin Verify

```bash
curl -X POST http://localhost:3005/kyc/admin/verify/{user_id} \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "verified"}'
```

## Port Configuration

Default port: `3005`

Override with environment variable:
```bash
KYC_PORT=3006 npm start
```

