# Database backups

Snapshots of the `permittrack` database, taken October 10, 2026.

| File | What it is |
|---|---|
| `permittrack_backup_20261010_before_031.sql` | The database as it was before the Messages changes (migrations up to 029). |
| `permittrack_current_20261010.sql` | The same data with migrations 030 (conversations) and 031 (application threads) applied — the current schema. |

**These copies are scrubbed, because this repository is public.** The structure and the demo data
are intact, but:

- every password is the demo password `Test1234!`;
- real email addresses are replaced with `user<id>@scrubbed.permittrack.demo`, and every mobile
  number with `+639` followed by the account id;
- the six real people's accounts (ids 137, 145, 161, 163, 168, 169) have placeholder names,
  birthdates, addresses and business names;
- one-time verification codes are emptied.

Keep the full, unscrubbed backups on your own computer, never in this repository.

## Restoring

Each file creates (if needed) and fills a database named `permittrack`, replacing the tables in it:

```
mysql -u root --default-character-set=utf8mb4 < database/backups/permittrack_current_20261010.sql
```

or use phpMyAdmin's Import tab. Restoring over a live database overwrites its data, so take a fresh
backup of that one first.
