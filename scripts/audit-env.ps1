# Dot-source before running any audit test, seed, migration or local server.
# Explicit exports prevent the developer .env from supplying live credentials.
$env:DATABASE_URL = 'postgresql://stackfox:stackfox_dev@127.0.0.1:55432/stackfox_audit_20260922'
$env:DIRECT_DATABASE_URL = $env:DATABASE_URL
$env:REDIS_URL = 'redis://127.0.0.1:56379/9'
$env:JWT_SECRET = 'audit-local-only-secret-at-least-32-characters'
$env:NODE_ENV = 'test'
$env:PORT = '4001'
$env:TEST_API_URL = 'http://127.0.0.1:4001'
$env:WORKERS_INLINE = 'false'
$env:CORS_ORIGIN = 'http://localhost:5175'
$env:ADMIN_PASSWORD = 'audit-local-admin-password-12345'
foreach ($auditName in @('SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_PUBLISHABLE_KEY','RESEND_API_KEY','SMTP_HOST','MSG91_AUTH_KEY','RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','GEMINI_API_KEY','MEILI_URL','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','WHATSAPP_BSP_URL','WHATSAPP_BSP_TOKEN','SENTRY_DSN')) {
  [Environment]::SetEnvironmentVariable($auditName, '', 'Process')
}
