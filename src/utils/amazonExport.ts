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
  const headers = [
    'Product',
    'Entity',
    'Operation',
    'Campaign ID',
    'Ad Group ID',
    'Portfolio ID',
    'Ad ID',
    'Keyword ID',
    'Product Targeting ID',
    'Campaign Name',
    'Ad Group Name',
    'Start Date',
    'End Date',
    'Targeting Type',
    'State',
    'Daily Budget',
    'SKU',
    'ASIN',
    'Ad Group Default Bid',
    'Bid',
    'Keyword Text',
    'Match Type',
    'Bidding Strategy',
  ];

  const rows: string[][] = [];
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  // Group catalog by designId
  const designSkuMap = new Map<string, ProductSKU[]>();
  catalog.forEach((item) => {
    const list = designSkuMap.get(item.designId) || [];
    list.push(item);
    designSkuMap.set(item.designId, list);
  });

  const shouldCreateAuto = strategy.campaignMode === 'AUTO_ONLY' || strategy.campaignMode === 'BOTH';
  const shouldCreateManual = strategy.campaignMode === 'MANUAL_ONLY' || strategy.campaignMode === 'BOTH';

  // ============================================================
  // 1. GENERATE AUTO CAMPAIGNS (Automatic Targeting)
  // ============================================================
  if (shouldCreateAuto && catalog.length > 0) {
    designSkuMap.forEach((skus, designId) => {
      const campName = `${strategy.campaignPrefix}_AUTO_${designId}`;
      // Clean Ad Group ID derived directly from the primary SKU without weird symbols
      const agName = deriveAdGroupNameFromSku(skus[0].sku);
      const dailyBudgetStr = strategy.dailyBudget.toFixed(2);

      // Campaign Row
      rows.push([
        'Sponsored Products',
        'Campaign',
        'Create',
        campName,
        '',
        '',
        '',
        '',
        '',
        campName,
        '',
        today,
        '',
        'AUTO',
        'enabled',
        dailyBudgetStr,
        '',
        '',
        '',
        '',
        '',
        '',
        strategy.biddingStrategy,
      ]);

      // Ad Group Row
      rows.push([
        'Sponsored Products',
        'Ad Group',
        'Create',
        campName,
        agName,
        '',
        '',
        '',
        '',
        campName,
        agName,
        '',
        '',
        '',
        'enabled',
        '',
        '',
        '',
        (skus[0].adGroupDefaultBid ?? strategy.adGroupDefaultBid).toFixed(2),
        '',
        '',
        '',
        '',
      ]);

      // Product Ad Rows (all SKUs for this design)
      skus.forEach((prod) => {
        rows.push([
          'Sponsored Products',
          'Product Ad',
          'Create',
          campName,
          agName,
          '',
          '',
          '',
          '',
          campName,
          agName,
          '',
          '',
          '',
          'enabled',
          '',
          prod.sku,
          prod.currentAsin || '',
          '',
          '',
          '',
          '',
          '',
        ]);
      });

      // Product Targeting Rows for the 4 Auto Targeting Groups
      const autoTargets: { type: string; bid: number }[] = [
        { type: 'close-match', bid: strategy.autoBids.closeMatch },
        { type: 'loose-match', bid: strategy.autoBids.looseMatch },
        { type: 'substitutes', bid: strategy.autoBids.substitutes },
        { type: 'complements', bid: strategy.autoBids.complements },
      ];

      autoTargets.forEach((tgt) => {
        rows.push([
          'Sponsored Products',
          'Product Targeting',
          'Create',
          campName,
          agName,
          '',
          '',
          '',
          '',
          campName,
          agName,
          '',
          '',
          '',
          'enabled',
          '',
          '',
          '',
          '',
          tgt.bid.toFixed(2),
          tgt.type,
          '',
          '',
        ]);
      });
    });
  }

  // ============================================================
  // 2. GENERATE MANUAL KEYWORD CAMPAIGNS (Size & Design Targeting)
  // ============================================================
  if (shouldCreateManual && catalog.length > 0) {
    const manualCampaignsSet = new Set<string>();
    const manualAdGroupsSet = new Set<string>();

    approvedKeywords.forEach((kw) => {
      manualCampaignsSet.add(kw.campaignName);
      manualAdGroupsSet.add(`${kw.campaignName}:::${kw.adGroupName}`);
    });

    // If no approved keywords yet, still scaffold campaigns from catalog designs
    if (manualCampaignsSet.size === 0) {
      designSkuMap.forEach((_, designId) => {
        manualCampaignsSet.add(`${strategy.campaignPrefix}_MANUAL_${designId}`);
      });
    }

    // Manual Campaign Rows
    manualCampaignsSet.forEach((campName) => {
      rows.push([
        'Sponsored Products',
        'Campaign',
        'Create',
        campName,
        '',
        '',
        '',
        '',
        '',
        campName,
        '',
        today,
        '',
        'MANUAL',
        'enabled',
        strategy.dailyBudget.toFixed(2),
        '',
        '',
        '',
        '',
        '',
        '',
        strategy.biddingStrategy,
      ]);
    });

    // Manual Ad Group Rows
    manualAdGroupsSet.forEach((composite) => {
      const [campName, agName] = composite.split(':::');
      const matchingSku = catalog.find((prod) => deriveAdGroupNameFromSku(prod.sku) === agName);
      const designOverrideSku = matchingSku ? undefined : catalog.find((prod) => campName.endsWith(`_${prod.designId}`) && prod.adGroupDefaultBid != null);
      const adGroupDefaultBid = matchingSku?.adGroupDefaultBid ?? designOverrideSku?.adGroupDefaultBid ?? strategy.adGroupDefaultBid;
      rows.push([
        'Sponsored Products',
        'Ad Group',
        'Create',
        campName,
        agName,
        '',
        '',
        '',
        '',
        campName,
        agName,
        '',
        '',
        '',
        'enabled',
        '',
        '',
        '',
        adGroupDefaultBid.toFixed(2),
        '',
        '',
        '',
        '',
      ]);
    });

    // Manual Product Ad Rows
    if (strategy.adGroupArchitecture === 'SINGLE_PER_DESIGN') {
      catalog.forEach((prod) => {
        const campName = `${strategy.campaignPrefix}_${prod.designId}`;
        const agName = `${prod.designId}--AllSizes`;
        rows.push([
          'Sponsored Products',
          'Product Ad',
          'Create',
          campName,
          agName,
          '',
          '',
          '',
          '',
          campName,
          agName,
          '',
          '',
          '',
          'enabled',
          '',
          prod.sku,
          prod.currentAsin || '',
          '',
          '',
          '',
          '',
          '',
        ]);
      });
    } else {
      catalog.forEach((prod) => {
        const campName = `${strategy.campaignPrefix}_${prod.designId}`;
        // Clean Ad Group ID derived directly from the SKU (e.g. DKUC-BSUT-168--18-24 months -> BSUT-168--18-24 months)
        const agName = deriveAdGroupNameFromSku(prod.sku);
        rows.push([
          'Sponsored Products',
          'Product Ad',
          'Create',
          campName,
          agName,
          '',
          '',
          '',
          '',
          campName,
          agName,
          '',
          '',
          '',
          'enabled',
          '',
          prod.sku,
          prod.currentAsin || '',
          '',
          '',
          '',
          '',
          '',
        ]);
      });
    }

    // Manual Keyword Rows
    approvedKeywords.forEach((kw) => {
      rows.push([
        'Sponsored Products',
        'Keyword',
        'Create',
        kw.campaignName,
        kw.adGroupName,
        '',
        '',
        '',
        '',
        kw.campaignName,
        kw.adGroupName,
        '',
        '',
        '',
        'enabled',
        '',
        '',
        '',
        '',
        kw.bid.toFixed(2),
        kw.keywordText,
        kw.matchType.toLowerCase(),
        '',
      ]);
    });

    // Approved Negative Keyword Rows
    approvedNegatives.forEach((neg) => {
      const matchType = neg.matchType === 'NEGATIVE_EXACT' ? 'negativeExact' : 'negativePhrase';
      rows.push([
        'Sponsored Products',
        'Negative Keyword',
        'Create',
        neg.campaignName,
        neg.adGroupName,
        '',
        '',
        '',
        '',
        neg.campaignName,
        neg.adGroupName,
        '',
        '',
        '',
        'enabled',
        '',
        '',
        '',
        '',
        '',
        neg.suggestedNegativeText,
        matchType,
        '',
      ]);
    });
  }

  // Convert to CSV string with escaping
  return [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => row.map(escapeCsvValue).join(',')),
  ].join('\r\n');
}

/**
 * Summary breakdown of all campaigns created for easy visual review
 */
export function generateCampaignSummaries(
  catalog: ProductSKU[],
  keywords: KeywordItem[],
  strategy: StrategySettings
): CampaignSummaryItem[] {
  const summaries: CampaignSummaryItem[] = [];
  const designSkuMap = new Map<string, ProductSKU[]>();
  catalog.forEach((item) => {
    const list = designSkuMap.get(item.designId) || [];
    list.push(item);
    designSkuMap.set(item.designId, list);
  });

  const shouldCreateAuto = strategy.campaignMode === 'AUTO_ONLY' || strategy.campaignMode === 'BOTH';
  const shouldCreateManual = strategy.campaignMode === 'MANUAL_ONLY' || strategy.campaignMode === 'BOTH';

  designSkuMap.forEach((skus, designId) => {
    if (shouldCreateAuto) {
      summaries.push({
        id: `camp-auto-${designId}`,
        campaignName: `${strategy.campaignPrefix}_AUTO_${designId}`,
        targetingType: 'AUTO',
        dailyBudget: skus[0].dailyBudget || strategy.dailyBudget,
        biddingStrategy: strategy.biddingStrategy,
        adGroupsCount: 1,
        skusCount: skus.length,
        keywordsOrTargetsCount: 4, // close-match, loose-match, substitutes, complements
        state: 'enabled',
      });
    }

    if (shouldCreateManual) {
      const designKeywords = keywords.filter((k) => k.designId === designId);
      const adGroups = new Set(designKeywords.map((k) => k.adGroupName));

      summaries.push({
        id: `camp-manual-${designId}`,
        campaignName: `${strategy.campaignPrefix}_${designId}`,
        targetingType: 'MANUAL',
        dailyBudget: strategy.dailyBudget,
        biddingStrategy: strategy.biddingStrategy,
        adGroupsCount: Math.max(1, adGroups.size),
        skusCount: skus.length,
        keywordsOrTargetsCount: designKeywords.length,
        state: 'enabled',
      });
    }
  });

  return summaries;
}

/**
 * Generates the user-requested Keyword Reporting CSV with all explicit fields:
 * SKU, Design/serial, Product type, Audience, Size/age range, Keyword text, Match type, Bid (₹), Source, Relevance/confidence, Approval status
 */
export function generateReportingCsv(keywords: KeywordItem[]): string {
  const headers = [
    'SKU',
    'Design / Serial',
    'Product Type',
    'Audience',
    'Size / Age Range',
    'Keyword Text',
    'Match Type',
    'Bid (₹ INR)',
    'Source',
    'Relevance / Confidence (%)',
    'Approval Status',
    'Ad Group Name',
    'Cross-Size Risk Warning',
  ];

  const rows = keywords.map((k) => [
    k.sku,
    k.designId,
    k.productType,
    k.audience,
    k.sizeDisplay,
    k.keywordText,
    k.matchType,
    `₹${k.bid.toFixed(2)}`,
    k.source,
    `${k.relevanceScore}%`,
    k.approvalStatus,
    k.adGroupName,
    k.hasAdGroupCrossSizeRisk ? 'YES - Cross-Size Variant Collision' : 'NO - Clean Isolation',
  ]);

  return [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => row.map(escapeCsvValue).join(',')),
  ].join('\r\n');
}

function escapeCsvValue(val: string | undefined): string {
  if (val === undefined || val === null) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export function downloadBlob(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;') {
  // Prepend \uFEFF UTF-8 BOM so Microsoft Excel and other spreadsheet viewers never corrupt characters (e.g. â€“)
  const prefix = mimeType.includes('csv') ? '\uFEFF' : '';
  const blob = new Blob([prefix + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
