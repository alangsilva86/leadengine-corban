import {
  bankIntegrationSettings,
  findBankIntegrationSettings,
  type BankIntegrationSettings,
  type BankProviderId,
} from '../../../config/bank-integrations';

import { AtlasPromotoraClient } from './atlas-promotora-client';
import { AuroraBankClient } from './aurora-bank-client';
import { ZeniteFinanceClient } from './zenite-finance-client';
import type { BankIntegrationClient, BankIntegrationClientFactory } from './types';

const factories: Record<BankProviderId, BankIntegrationClientFactory> = {
  'atlas-promotora': (settings) => new AtlasPromotoraClient(settings),
  'aurora-bank': (settings) => new AuroraBankClient(settings),
  'zenite-finance': (settings) => new ZeniteFinanceClient(settings),
};

export const createBankIntegrationClient = (
  settings: BankIntegrationSettings
): BankIntegrationClient | null => {
  const factory = factories[settings.id];
  if (!factory) {
    return null;
  }

  return factory(settings);
};

export const buildBankIntegrationClientMap = (): Map<BankProviderId, BankIntegrationClient> => {
  const entries: Array<[BankProviderId, BankIntegrationClient]> = [];

  for (const settings of bankIntegrationSettings) {
    if (!settings.enabled) {
      continue;
    }

    const client = createBankIntegrationClient(settings);
    if (client) {
      entries.push([settings.id, client]);
    }
  }

  return new Map(entries);
};

export const bankIntegrationClients = buildBankIntegrationClientMap();

export const getBankIntegrationClient = (
  providerId: BankProviderId
): BankIntegrationClient | undefined => bankIntegrationClients.get(providerId);

export const getBankIntegrationSettings = (
  providerId: BankProviderId
): BankIntegrationSettings | undefined => findBankIntegrationSettings(providerId);

export const listBankIntegrationSettings = (): BankIntegrationSettings[] => bankIntegrationSettings;

