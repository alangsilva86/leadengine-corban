if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret';
}

if (!process.env.POLL_METADATA_ENCRYPTION_KEY) {
  process.env.POLL_METADATA_ENCRYPTION_KEY = 'test-poll-encryption-key';
}
