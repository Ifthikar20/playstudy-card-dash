# UUID Migration Guide

This guide explains how to migrate your database from integer-based session IDs to UUID-based session IDs.

## Overview

The application has been updated to use UUIDs (Universally Unique Identifiers) for study session IDs instead of auto-incrementing integers. This change provides:

- **Globally unique identifiers** across distributed systems
- **Better security** (no sequential ID enumeration)
- **Industry standard** format for session tracking
- **Improved scalability** for future features

## Migration Process

### Prerequisites

1. **Backup your database** before proceeding
2. Ensure you have the latest code deployed
3. Stop any running application instances to prevent data corruption

### Step 1: Check Your Database Type

The migration script supports both PostgreSQL and SQLite. It will automatically detect your database type from the `DATABASE_URL` environment variable.

```bash
# Check your database URL
cat .env | grep DATABASE_URL
```

### Step 2: Run the Migration

```bash
cd backend
python migrate_to_uuid.py
```

The script will:
1. Create a backup of your `study_sessions` table
2. Generate new UUIDs for all existing sessions
3. Update all foreign key relationships
4. Preserve all session data and relationships
5. Verify the migration was successful

### Step 3: Verify the Migration

After the migration completes, verify:

1. **Check session count:**
   ```sql
   SELECT COUNT(*) FROM study_sessions;
   ```

2. **Check UUID format:**
   ```sql
   SELECT id FROM study_sessions LIMIT 5;
   ```

   You should see UUIDs like: `550e8400-e29b-41d4-a716-446655440000`

3. **Test the application:**
   - Start your application
   - Create a new study session
   - Access existing sessions by clicking them in the sidebar
   - Verify URLs show UUIDs: `http://localhost:8080/full-study/550e8400-...`

### Step 4: Clean Up

If everything works correctly, remove the backup table:

```sql
DROP TABLE study_sessions_backup;
```

## Rollback Procedure

If something goes wrong, you can restore from the backup:

### PostgreSQL:
```sql
BEGIN;
DROP TABLE study_sessions;
ALTER TABLE study_sessions_backup RENAME TO study_sessions;
COMMIT;
```

### SQLite:
```sql
DROP TABLE study_sessions;
ALTER TABLE study_sessions_backup RENAME TO study_sessions;
```

## Breaking Changes

⚠️ **Important:** This is a breaking change!

- **Old session URLs will not work** after migration
- **Browser cache** may need to be cleared (or wait 5 minutes for TTL)
- **Bookmarked URLs** with old integer IDs will need to be updated

## Database Schema Changes

### Before (Integer IDs):
```sql
study_sessions:
  id: INTEGER PRIMARY KEY

topics:
  study_session_id: INTEGER REFERENCES study_sessions(id)
```

### After (UUID):
```sql
study_sessions:
  id: UUID PRIMARY KEY  (PostgreSQL)
  id: TEXT PRIMARY KEY  (SQLite - stores UUID as string)

topics:
  study_session_id: UUID REFERENCES study_sessions(id)  (PostgreSQL)
  study_session_id: TEXT REFERENCES study_sessions(id)  (SQLite)
```

## Troubleshooting

### Migration fails with "permission denied"
- Ensure your database user has ALTER TABLE permissions
- Check that no other processes are accessing the database

### Migration fails with "foreign key constraint"
- The script handles foreign keys automatically
- If you have custom foreign keys, you may need to drop them first

### UUIDs not showing in frontend
- Clear browser localStorage: `localStorage.clear()` in browser console
- Wait 5 minutes for cache TTL to expire
- Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)

### Session data lost after migration
- Check the backup table: `SELECT * FROM study_sessions_backup;`
- Restore from backup using the rollback procedure above

## Performance Notes

- The migration generates UUIDs for all existing sessions
- For large databases (>10,000 sessions), the migration may take a few minutes
- The script uses transactions to ensure data integrity
- PostgreSQL: Uses native UUID type with gen_random_uuid()
- SQLite: Uses TEXT column with UUID string representation

## Support

If you encounter issues:

1. Check the migration script output for specific errors
2. Verify your database connection settings
3. Ensure you have proper database permissions
4. Review the troubleshooting section above

## Manual Migration (Alternative)

If the automated script doesn't work, you can use the SQL migration files:

### PostgreSQL:
```bash
psql -d your_database -f migrate_uuid.sql
```

### SQLite:
```bash
sqlite3 your_database.db < migrate_uuid.sql
```

Note: Manual migration requires editing the SQL file to uncomment the appropriate section for your database type.

## Post-Migration Checklist

- [ ] Database migration completed successfully
- [ ] New sessions created with UUID format
- [ ] Existing sessions accessible via new UUID URLs
- [ ] No errors in application logs
- [ ] Browser cache cleared (if needed)
- [ ] Backup table removed (after verification)
- [ ] Team notified of URL format change

---

**Last Updated:** December 14, 2025
**Migration Script:** `backend/migrate_to_uuid.py`
**SQL Script:** `backend/migrate_uuid.sql`
