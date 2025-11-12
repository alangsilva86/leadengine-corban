const normalizeTicketString = (value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
};

const resolveTicketMetadataField = (ticket, key) => {
  if (!ticket || typeof ticket !== 'object') {
    return null;
  }
  const metadata = ticket.metadata;
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  return normalizeTicketString(metadata[key]);
};

export const resolveTicketSourceInstance = (ticket) => {
  const metadataSource = resolveTicketMetadataField(ticket, 'sourceInstance');
  if (metadataSource) {
    return metadataSource;
  }
  const metadataInstance = resolveTicketMetadataField(ticket, 'instanceId');
  if (metadataInstance) {
    return metadataInstance;
  }
  return normalizeTicketString(ticket?.instanceId);
};

export const resolveTicketCampaignId = (ticket) => {
  const metadataCampaignId = resolveTicketMetadataField(ticket, 'campaignId');
  if (metadataCampaignId) {
    return metadataCampaignId;
  }
  return normalizeTicketString(ticket?.lead?.campaignId);
};

export const resolveTicketCampaignName = (ticket) => {
  const metadataCampaignName = resolveTicketMetadataField(ticket, 'campaignName');
  if (metadataCampaignName) {
    return metadataCampaignName;
  }
  const leadCampaignName = normalizeTicketString(ticket?.lead?.campaignName);
  if (leadCampaignName) {
    return leadCampaignName;
  }
  return normalizeTicketString(ticket?.lead?.campaign?.name);
};

export const resolveTicketProductType = (ticket) => {
  return resolveTicketMetadataField(ticket, 'productType');
};

export const resolveTicketStrategy = (ticket) => {
  return resolveTicketMetadataField(ticket, 'strategy');
};

export const resolveTicketContext = (ticket) => {
  const instance = resolveTicketSourceInstance(ticket);
  const campaignId = resolveTicketCampaignId(ticket);
  const campaignName = resolveTicketCampaignName(ticket);
  const productType = resolveTicketProductType(ticket);
  const strategy = resolveTicketStrategy(ticket);

  return {
    instance,
    campaignId,
    campaignName,
    productType,
    strategy,
  };
};

export { normalizeTicketString };
