import { describe, expect, it } from 'vitest';
import {
  CONTEXTUAL_NAVIGATION_IDS,
  EXPOSED_NAVIGATION_PAGE_IDS,
  NAVIGATION_PAGES,
  PRIMARY_NAVIGATION_IDS,
} from './routes.ts';

describe('navigation routes', () => {
  it('only references declared pages in navigation sections', () => {
    const knownIds = new Set(Object.keys(NAVIGATION_PAGES));
    [...PRIMARY_NAVIGATION_IDS, ...CONTEXTUAL_NAVIGATION_IDS].forEach((id) => {
      expect(knownIds.has(id)).toBe(true);
    });
  });

  it('tracks the path for all exposed pages', () => {
    EXPOSED_NAVIGATION_PAGE_IDS.forEach((pageId) => {
      const definition = NAVIGATION_PAGES[pageId];
      expect(definition).toBeTruthy();
      expect(definition.path).toBeTruthy();
    });
  });
});
