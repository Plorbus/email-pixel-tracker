# email pixel tracker

A self hosted email open tracker(like read receipts on iMessage!). You send an email from a web form, and
the app embeds a 1×1 transparent GIF whose URL contains a unique ID. When the
recipient's email client loads that image, the server logs the open.

Built as a learning project to understand how email tracking
actually works under the hood.

## How it works

1. Create an email in the admin UI.
2. The app generates a UUID, stores the send in SQLite, and appends
   `<img src="https://your-host/pixel/<uuid>" width="1" height="1">` to the body.
3. The mail client fetches that image when the email is displayed.
4. The server returns the GIF immediately, then records the open (timestamp, IP, user agent). Deliberately serve first so
   a database error can never break pixel delivery.
   
## Stack

Node.js, Express 5, SQLite (better-sqlite3), Nodemailer. No frontend framework (raw HTML will update this later, ran out of time...)
Pages are server rendered. Schema changes are handled by a hand written versioned
migration file using SQLite's `PRAGMA user_version`.

## Running it

```
npm ci
cp .env.example .env    # then fill it in
npm start
```


Required environment variables:
(Realistically, this can be edited to fit with other mailing services, this is just what works with Google, so I kept it as it's the majority, in all honesty)
| Variable | Purpose |
| --- | --- |
| `GMAIL_USER` | Gmail address that sends the mail |
| `GMAIL_APP_PASS` | Google App Password (not your account password // you NEED to generate this via the App passwords page on google) |
| `PUBLIC_URL` | Public base URL the pixel points at |
| `ADMIN_USER` / `ADMIN_PASS` | Credentials for the admin routes (login and password when accessing) |

`PUBLIC_URL` must be reachable from the public internet, since the recipient's mail
server fetches the image, so `localhost` records nothing.

Side note: values are loaded by Node's built-in `--env-file`, which makes unquoted `#` act as comments
and not part of the user/password. tldr avoid hashtags/pounds in your USER/PASS, or dont idc.

## Routes

- `GET /pixel/:id` | public, returns the GIF and records an open
- `GET /admin` | send form and results table (HTTP Basic Auth)
- `POST /admin/send` | sends a tracked email (HTTP Basic Auth)
- `GET /results` | raw JSON (HTTP Basic Auth)

## Limitations

Open tracking is inherently approximate, and Gmail in particular is noisy:

Google proxies images through its own servers, so the logged IP and user agent
belong to Google, not the recipient.

Gmail prefetches images on delivery, so an open is recorded whether or not a
human ever looked at the message.

The pixel is served with `no-cache` headers so repeat views register. That means
the count reflects how many times the client rendered the image, not how many
times someone read the email.

Any email/client that blocks remote images records nothing.

Treat the numbers as a "maybe someone read it", not a "They read my email and ghosted me".

## Scope

Personal and educational. Tested only against me and my family's email accounts. The admin routes can send
mail as the configured Gmail account. Overall, this should only be used by a single trusted operator and is not safe
to expose without first hardening authentication and security(same thing ik).





