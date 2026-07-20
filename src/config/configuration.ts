export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  appName: process.env.APP_NAME ?? 'Subflow',
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    name: process.env.DB_NAME ?? 'monnify_subscriptions',
    logging: process.env.DB_LOGGING ?? false,
  },
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? '',
    tls: process.env.REDIS_TLS === 'true',
  },
  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-in-production',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ??
      'dev-refresh-secret-change-in-production',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY ?? 'dev-encryption-key-32-bytes-long!',
  },
  monnify: {
    // Sandbox: https://sandbox.monnify.com | Live: https://api.monnify.com
    apiUrl: process.env.MONNIFY_API_URL ?? 'https://sandbox.monnify.com',
    apiKey: process.env.MONNIFY_API_KEY ?? '',
    // Client secret used for OAuth + monnify-signature (HMAC-SHA512) verification
    secretKey: process.env.MONNIFY_SECRET_KEY ?? '',
    contractCode: process.env.MONNIFY_CONTRACT_CODE ?? '',
    // Optional override; signature verification prefers secretKey
    webhookSecret: process.env.MONNIFY_WEBHOOK_SECRET ?? '',
    subAccountId: process.env.MONNIFY_SUB_ACCOUNT_ID ?? '',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM ?? '',
    smsFrom: process.env.TWILIO_SMS_FROM ?? '',
  },
  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
  },
  dashboardUrl: process.env.DASHBOARD_URL ?? 'http://localhost:3000',
  appUrl:
    process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? '3000'}`,
  mail: {
    enabled: process.env.MAIL_ENABLED !== 'false',
    host: process.env.MAIL_HOST ?? 'smtp-relay.brevo.com',
    port: parseInt(process.env.MAIL_PORT ?? '587', 10),
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER ?? '',
    password: process.env.MAIL_PASSWORD ?? '',
    fromName: process.env.MAIL_FROM_NAME ?? process.env.APP_NAME ?? 'Subflow',
    fromAddress:
      process.env.MAIL_FROM_ADDRESS ??
      process.env.MAIL_USER ??
      'noreply@nse.com',
  },
});
