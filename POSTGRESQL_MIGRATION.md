# PostgreSQL Migration Guide

Your anesthesia workers application has been migrated from SQLite to PostgreSQL. Here's how to set it up:

## Prerequisites

- PostgreSQL database on Render.com (or another PostgreSQL provider)
- Node.js installed locally
- `.env` file configured with your PostgreSQL connection string

## Step 1: Create PostgreSQL Database on Render.com

1. Go to [render.com](https://render.com)
2. Create a new **PostgreSQL** database
3. Copy the connection string (it will look like: `postgresql://user:password@host:port/dbname`)

## Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Edit `backend/.env` and update:
   ```
   DATABASE_URL=postgresql://user:password@your-render-host:5432/dbname
   NODE_ENV=production
   SMTP_HOST=your-smtp-host
   SMTP_PORT=587
   SMTP_USER=your-email@example.com
   SMTP_PASS=your-app-password
   APP_URL=https://your-frontend-domain.com
   ```

## Step 3: Install Dependencies

```bash
cd backend
npm install
```

This will now install `pg` instead of `better-sqlite3`.

## Step 4: Migrate Data (Optional - if you have existing SQLite data)

If you have existing data in SQLite that you want to preserve:

1. Install `better-sqlite3` temporarily:
   ```bash
   npm install better-sqlite3
   ```

2. Run the migration script:
   ```bash
   node migrate.js
   ```

3. The script will migrate all tables and data to PostgreSQL

4. Once complete, you can uninstall `better-sqlite3`:
   ```bash
   npm uninstall better-sqlite3
   ```

## Step 5: Start the Application

### Local Development

```bash
cd backend
npm run dev
```

### Production Deployment

```bash
cd backend
npm start
```

## Important Changes

### Database Module (`db.js`)
- New file that handles PostgreSQL connection pooling
- Automatically initializes database schema on startup
- Export functions: `query()`, `pool`, `initializeSchema()`

### Server Refactoring (`server.js`)
- All database calls are now async/await
- Routes now return proper error handling
- Database connection pooling for better performance
- Removed SQLite-specific code (PRAGMA statements, WAL mode)

### Key Differences from SQLite

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Placeholders | `?` | `$1, $2, ...` |
| ID Generation | `lastInsertRowid` | `RETURNING id` |
| Affected Rows | `.changes` | `.rowCount` |
| Timestamps | `datetime('now')` | `NOW()` or `CURRENT_TIMESTAMP` |
| Connection | File-based | Connection pooling |
| Concurrency | Limited | Full concurrent access |

## Troubleshooting

### Connection Errors
- Verify `DATABASE_URL` in `.env` is correct
- Check Network access rules on Render.com (should allow all IPs)
- Ensure PostgreSQL database is running

### Schema Issues
- The application automatically creates tables on startup
- Check console logs for any schema errors
- You can manually review the schema in `db.js`

### Data Migration Issues
- If migration fails, check that both databases are accessible
- Verify the migration script has read access to SQLite and write access to PostgreSQL
- Check console output for specific error messages

## Deployment to Render.com

1. Connect your GitHub repository to Render
2. Set environment variables in Render dashboard
3. Set start command: `cd backend && npm install && npm start`
4. Rebuild and deploy

## Rollback

The original SQLite files remain in `backend/data/workers.db` if you need to revert. To switch back to SQLite:
1. Reinstall `better-sqlite3`: `npm install better-sqlite3`
2. Start the application with the original code
3. Update `package.json` and `server.js` accordingly

## Support

For issues or questions, refer to:
- PostgreSQL documentation: https://www.postgresql.org/docs/
- Render.com docs: https://render.com/docs
- Node pg package: https://node-postgres.com/
