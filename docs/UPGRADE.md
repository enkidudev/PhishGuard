# Update an existing installation

Stop the server and back up your local configuration and SQLite database. Keep `.env` and your existing database when moving to the new version. Older Git checkouts may track `db/custom.db`. Back it up outside the checkout before pulling the cleanup commit, then restore it afterward.

On Windows, double-click `run.bat` after updating. On macOS or Linux, run `npm ci`, `npm run setup`, `npm run db:push`, and `npm run templates:install` before restarting the server.

Open the exact origin in `.env`. The default local address is http://127.0.0.1:3000. Use `npm run setup -- --repair-local` to restore local HTTP settings on a development machine.

Leave your work database in place. The demo reset command replaces database contents and is intended for disposable demos only.
