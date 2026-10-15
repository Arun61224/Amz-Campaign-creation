import {
  ProductSKU,
  KeywordItem,
  StrategySettings,
  MatchType,
  DeduplicationGroup,
  STANDARD_PRODUCT_TYPES,
} from '../types';
import { normalizeAgeExpression, deriveAdGroupNameFromSku } from './skuParser';

export const DEFAULT_STRATEGY: StrategySettings = {
  currency: 'INR',
  currencySymbol: '₹',
  campaignMode: 'BOTH',
  dailyBudget: 500.0,
  adGroupDefaultBid: 5.0,
  biddingStrategy: 'Dynamic bids - down only',
  autoBids: {
    closeMatch: 16.0,
    looseMatch: 12.0,
    substitutes: 14.0,
    complements: 10.0,
  },
  adGroupArchitecture: 'SEPARATE_PER_SIZE',
  campaignPrefix: 'SP_KUCHIPOO',
  defaultBids: {
    EXACT: 18.0,
    PHRASE: 15.0,
    BROAD: 12.0,
  },
  enabledMatchTypes: {
    EXACT: true,
    PHRASE: true,
    BROAD: true,
  },
  generateSizeKeywords: true,
  includeExactAgeRange: true,
  includeAlternateAgeWording: true,
  includeMonthBasedTerms: true,
  shareDesignLevelKeywordsAcrossSizes: true,
  requireManualApproval: false,
  minRelevanceScore: 65,
  maxSizeKeywordsPerSku: 45,
  targetScope: 'ALL_SKUS',
  selectedGroups: [],
};

/**
 * STRICT FILTER: Checks if a generated keyword string contains raw internal SKU patterns
 * e.g., "DKUC-bust-168", "DKUC-BSUT-168", "KUC-HOD-242", "DKUC", "bust-168", etc.
 * Amazon shoppers never search for internal SKU codes!
 */
export function isSkuPollutedKeyword(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  
  // 1. Matches prefix patterns like "dkuc-", "kuc-", "d-", "dkuc"
  if (/\b(dkuc|kuc)[-_]?[a-z0-9]*/i.test(lower)) {
    return true;
  }

  // 2. Matches hyphenated internal code patterns like "bust-168", "bsut-168", "hod-242", "psut-291", "tpset-501"
  if (/\b(bsut|bust|hod|psut|tpset|crg|swtr|romp|blm|vlvt|jkt)[-_]\d+\b/i.test(lower)) {
    return true;
  }

  // 3. Standalone code followed by numbers (e.g. "bsut 168", "bust 168")
  if (/\b(bsut|bust|tpset)[-_ ]+\d+\b/i.test(lower)) {
    return true;
  }

  return false;
}

/**
 * Sanitizes brand name to prevent SKU strings from acting as brand
 */
export function sanitizeBrandName(brand: string): string {
  if (!brand) return 'KUCHIPOO';
  const clean = brand.replace(/^D[A-Z]{2,5}[-_]/i, '').replace(/[-_]\d+/g, '').trim();
  if (!clean || isSkuPollutedKeyword(clean)) {
    return 'KUCHIPOO';
  }
  return clean;
}

/**
 * Sanitizes and normalizes product type to ensure it is always a natural shopper category
 * Accurately supports the user's 14 exact product categories:
 * - T-shirts Set
 * - Shorts Set
 * - Cargo Pants
 * - Trackpants
 * - Pajamas
 * - Hoddies
 * - Sweaters
