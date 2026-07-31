# Deltaora API Documentation

Base URL: `/api/v1`

## Auth

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login and get access token
- `POST /auth/refresh` - Refresh access token using cookie
- `POST /auth/logout` - Logout and clear cookie

## Pages

- `GET /pages` - List all monitored pages
  - Queries: `?category=x&status=y&search=z`
- `POST /pages` - Add a URL to monitor
- `GET /pages/:id` - Get page details + latest snapshot
- `PUT /pages/:id` - Update page config
- `DELETE /pages/:id` - Stop monitoring and delete page
- `PATCH /pages/:id/status` - Pause or resume monitoring

## History

- `GET /pages/:pageId/snapshots` - Version history
- `GET /pages/:pageId/diffs` - Diff history
- `GET /pages/:pageId/summaries` - AI Summary history

## Dashboard & Search

- `GET /dashboard` - Dashboard stats (cached)
- `GET /search?q=` - Search across URLs and summaries (cached)

## Notifications

- `GET /notifications` - List notifications
- `PATCH /notifications/:id/read` - Mark as read
- `PATCH /notifications/read-all` - Mark all as read
- `DELETE /notifications/:id` - Delete notification
