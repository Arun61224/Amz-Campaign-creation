import { 
  KeywordItem, 
  NegativeKeywordSuggestion, 
  ProductSKU, 
  StrategySettings,
  CampaignSummaryItem 
} from '../types';
import { deriveAdGroupNameFromSku } from './skuParser';

/**
 * Generates an Amazon Advertising Sponsored Products Bulk Template compatible CSV
 * Supports:
 * - MANUAL Campaigns (with Size-Specific & Design Keywords)
 * - AUTO Campaigns (with close-match, loose-match, substitutes, complements product targeting)
 * - BOTH Dual Strategy (Full Amazon PPC launch ready)
 */
export function generateAmazonBulkCsv(
  approvedKeywords: KeywordItem[],
  approvedNegatives: NegativeKeywordSuggestion[],
  catalog: ProductSKU[],
  strategy: StrategySettings
): string {
  // Keep this column order exactly aligned with Amazon's current
  // AdvertisingBulksheetTemplate seller workbook (Sponsored Products Campaigns).
  const headers = [
    'Product', 'Entity', 'Operation', 'Campaign ID', 'Ad Group ID', 'Portfolio ID',
    'Ad ID', 'Keyword ID', 'Product Targeting ID', 'Campaign Name', 'Ad Group Name',
    'Start Date', 'End Date', 'Targeting Type', 'State', 'Daily Budget', 'SKU',
    'Ad Group Default Bid', 'Bid', 'Keyword Text', 'Native Language Keyword',
    'Native Language Locale', 'Match Type', 'Bidding Strategy', 'Placement',
    'Percentage', 'Product Targeting Expression', 'Audience ID',
    'Shopper Cohort Percentage', 'Shopper Cohort Type', 'Sites', 'Off-Amazon ad serving',
  ];

  type Row = Record<string, string | number | undefined | null>;
  const rows: string[][] = [];
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const pushRow = (row: Row) => rows.push(headers.map((header) => {
    const value = row[header];
    return value === undefined || value === null ? '' : String(value);
  }));
  const money = (value: number) => Number.isFinite(value) ? value.toFixed(2) : '0.00';

  const designSkuMap = new Map<string, ProductSKU[]>();
  catalog.forEach((item) => {
    const list = designSkuMap.get(item.designId) || [];
    list.push(item);
    designSkuMap.set(item.designId, list);
  });

  const shouldCreateAuto = strategy.campaignMode === 'AUTO_ONLY' || strategy.campaignMode === 'BOTH';
  const shouldCreateManual = strategy.campaignMode === 'MANUAL_ONLY' || strategy.campaignMode === 'BOTH';

  // AUTO: one campaign per design, with one ad group containing all size SKUs.
  if (shouldCreateAuto) {
    designSkuMap.forEach((skus, designId) => {
      const campaignName = `${strategy.campaignPrefix}_AUTO_${designId}`;
      const adGroupName = deriveAdGroupNameFromSku(skus[0].sku);

      pushRow({
        Product: 'Sponsored Products', Entity: 'Campaign', Operation: 'Create',
        'Campaign Name': campaignName, 'Start Date': today, 'Targeting Type': 'auto',
        State: 'enabled', 'Daily Budget': money(strategy.dailyBudget),
        'Bidding Strategy': strategy.biddingStrategy,
      });
      pushRow({
        Product: 'Sponsored Products', Entity: 'Ad Group', Operation: 'Create',
        'Campaign Name': campaignName, 'Ad Group Name': adGroupName, State: 'enabled',
        'Ad Group Default Bid': money(skus[0].adGroupDefaultBid ?? strategy.adGroupDefaultBid),
      });

      skus.forEach((product) => pushRow({
        Product: 'Sponsored Products', Entity: 'Product Ad', Operation: 'Create',
        'Campaign Name': campaignName, 'Ad Group Name': adGroupName,
        State: 'enabled', SKU: product.sku,
      }));

      const autoTargets = [
        { expression: 'close-match', bid: strategy.autoBids.closeMatch },
        { expression: 'loose-match', bid: strategy.autoBids.looseMatch },
        { expression: 'substitutes', bid: strategy.autoBids.substitutes },
        { expression: 'complements', bid: strategy.autoBids.complements },
      ];
      autoTargets.forEach((target) => pushRow({
        Product: 'Sponsored Products', Entity: 'Product Targeting', Operation: 'Create',
        'Campaign Name': campaignName, 'Ad Group Name': adGroupName, State: 'enabled',
        Bid: money(target.bid), 'Product Targeting Expression': target.expression,
      }));
    });
  }

  // MANUAL: campaign/ad group names come from generated keywords. Create a
  // campaign scaffold even when no keywords have been approved yet.
  if (shouldCreateManual) {
    const campaignNames = new Set<string>();
    const adGroupPairs = new Map<string, { campaignName: string; adGroupName: string }>();
