export const CONNECTION_STATUS_MAP = {
  success: 'connected',
  info: 'reconnecting',
  warning: 'attention',
  destructive: 'attention',
  secondary: 'disconnected',
  default: 'disconnected',
};

export const resolveConnectionState = (statusInfo) => {
  if (!statusInfo) {
    return 'disconnected';
  }

  return CONNECTION_STATUS_MAP[statusInfo.variant] ?? CONNECTION_STATUS_MAP.default;
};
