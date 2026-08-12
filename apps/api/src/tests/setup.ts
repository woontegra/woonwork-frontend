import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.SOCIAL_TOKEN_ENCRYPTION_KEY) {
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = 'test-only-social-token-key-32b!!';
}
if (!process.env.META_GRAPH_API_VERSION) {
  process.env.META_GRAPH_API_VERSION = 'v21.0';
}
if (!process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL = 'http://localhost:5173';
}
if (!process.env.META_APP_ID) {
  process.env.META_APP_ID = 'test-meta-app-id';
}
if (!process.env.META_APP_SECRET) {
  process.env.META_APP_SECRET = 'test-meta-app-secret';
}
if (!process.env.META_LOGIN_CONFIG_ID) {
  process.env.META_LOGIN_CONFIG_ID = 'test-meta-login-config-id';
}
