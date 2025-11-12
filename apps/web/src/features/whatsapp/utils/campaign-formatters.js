export const formatAgreementLabel = (campaign) => {
  if (campaign?.agreementName) {
    return campaign.agreementName;
  }
  if (campaign?.agreementId) {
    return `Convênio ${campaign.agreementId}`;
  }
  return 'Convênio não informado';
};
