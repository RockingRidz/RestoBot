import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'test' && process.env.RESTOBOT_LOAD_ENV !== 'false') {
  dotenv.config({ path: '.env.local', quiet: true });
  dotenv.config({ quiet: true });
}
