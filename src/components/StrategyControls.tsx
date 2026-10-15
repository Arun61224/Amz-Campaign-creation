import React from 'react';
import { 
  Settings2, 
  Layers, 
  IndianRupee, 
  Zap, 
  Target
} from 'lucide-react';
import { StrategySettings, AdGroupArchitecture, CampaignMode } from '../types';

interface StrategyControlsProps {
  settings: StrategySettings;
  onChange: (updated: StrategySettings) => void;
  availableProductGroups: string[];
  isDark?: boolean;
}

export const StrategyControls: React.FC<StrategyControlsProps> = ({
  settings,
  onChange,
  availableProductGroups,
  isDark = false,
}) => {
  const updateSetting = <K extends keyof StrategySettings>(
    key: K,
    value: StrategySettings[K]
  ) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  const toggleMatchType = (type: 'BROAD' | 'PHRASE' | 'EXACT') => {
    onChange({
      ...settings,
      enabledMatchTypes: {
        ...settings.enabledMatchTypes,
        [type]: !settings.enabledMatchTypes[type],
      },
    });
  };

  const updateBid = (type: 'BROAD' | 'PHRASE' | 'EXACT', bid: number) => {
    onChange({
      ...settings,
      defaultBids: {
        ...settings.defaultBids,
        [type]: Math.max(0.05, bid),
      },
    });
  };

  const updateAutoBid = (targetType: keyof StrategySettings['autoBids'], bid: number) => {
    onChange({
      ...settings,
      autoBids: {
        ...settings.autoBids,
        [targetType]: Math.max(0.05, bid),
      },
    });
  };

  return (
    <div className={`rounded-2xl p-5 mb-6 shadow-xs border transition-colors ${
      isDark 
        ? 'bg-slate-900 border-slate-800 text-slate-200' 
        : 'bg-white border-slate-200 text-slate-800'
    }`}>
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 mb-4 border-b gap-3 ${
        isDark ? 'border-slate-800' : 'border-slate-100'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Settings2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Amazon Campaign Settings & INR (₹) Bidding Rules
            </h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Configure Auto vs Manual targeting, daily budgets, and size keyword match types
            </p>
          </div>
        </div>

        {/* Currency Badge */}
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1 self-start sm:self-auto font-mono">
          Currency: INR (₹)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Column 1: Campaign Mode & Budget */}
        <div className="space-y-3.5">
          <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
