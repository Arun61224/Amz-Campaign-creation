import React, { useState, useMemo } from 'react';
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  TrendingUp, 
  IndianRupee, 
  Check, 
  X, 
  ShieldAlert, 
  Info,
  ChevronDown,
  Sparkles,
  Flame
} from 'lucide-react';
import { KeywordItem, KeywordCategory, MatchType, ApprovalStatus } from '../types';

interface KeywordTableProps {
  keywords: KeywordItem[];
  onUpdateApproval: (id: string, status: ApprovalStatus) => void;
  onBulkUpdateApproval: (ids: string[], status: ApprovalStatus) => void;
  onUpdateBid: (id: string, newBid: number) => void;
  onBulkAdjustBids: (ids: string[], factorOrFixed: { type: 'PERCENT' | 'FIXED'; value: number }) => void;
  onOpenNegativesQueue: () => void;
  pendingNegativesCount: number;
  onOpenGoogleTrends?: () => void;
  isDark?: boolean;
}

export const KeywordTable: React.FC<KeywordTableProps> = ({
  keywords,
  onUpdateApproval,
  onBulkUpdateApproval,
  onUpdateBid,
  onBulkAdjustBids,
  onOpenNegativesQueue,
  pendingNegativesCount,
  onOpenGoogleTrends,
  isDark = false,
}) => {
  const [activeTab, setActiveTab] = useState<KeywordCategory | 'ALL'>('SIZE_SPECIFIC');
  const [searchQuery, setSearchQuery] = useState('');
  const [matchTypeFilter, setMatchTypeFilter] = useState<'ALL' | MatchType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ApprovalStatus>('ALL');
  const [onlyRiskWarnings, setOnlyRiskWarnings] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBidInput, setBulkBidInput] = useState<string>('14.00'); // Default ₹14.00 INR
  const [showBulkBidMenu, setShowBulkBidMenu] = useState(false);

  // Tab counts
  const counts = useMemo(() => {
    return {
      SIZE_SPECIFIC: keywords.filter((k) => k.category === 'SIZE_SPECIFIC').length,
      DESIGN_LEVEL: keywords.filter((k) => k.category === 'DESIGN_LEVEL').length,
      CHARACTER_SPECIFIC: keywords.filter((k) => k.category === 'CHARACTER_SPECIFIC').length,
      GENERIC: keywords.filter((k) => k.category === 'GENERIC').length,
      ALL: keywords.length,
      RISK: keywords.filter((k) => k.hasAdGroupCrossSizeRisk).length,
    };
  }, [keywords]);

  // Filtered keywords
  const filteredKeywords = useMemo(() => {
    return keywords.filter((k) => {
      // Tab filter
      if (activeTab !== 'ALL' && k.category !== activeTab) {
        return false;
      }

      // Match type filter
      if (matchTypeFilter !== 'ALL' && k.matchType !== matchTypeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && k.approvalStatus !== statusFilter) {
        return false;
      }

      // Cross-size risk filter
      if (onlyRiskWarnings && !k.hasAdGroupCrossSizeRisk) {
        return false;
      }

      // Search query (keyword text, SKU, design, size, or audience)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesText = k.keywordText.toLowerCase().includes(q);
        const matchesSku = k.sku.toLowerCase().includes(q);
        const matchesDesign = k.designId.toLowerCase().includes(q);
        const matchesSize = k.sizeDisplay.toLowerCase().includes(q);
        const matchesAudience = k.audience.toLowerCase().includes(q);
        return matchesText || matchesSku || matchesDesign || matchesSize || matchesAudience;
      }
