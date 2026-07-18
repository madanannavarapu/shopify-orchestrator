export interface App {
  id: string;
  name: string;
  handle: string;
  category: string | null;
  monthlyCost: number | null;
  billingInterval: string | null;
  developerName: string | null;
  installedAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
  performanceScore: number | null;
  recommendation: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPurpose: string | null;
  reviewCadence: string | null;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  permissions: AppPermission[];
  events: AppEvent[];
}

export interface AppPermission {
  id: string;
  scope: string;
  isHighRisk: boolean;
}

export interface AppEvent {
  id: string;
  action: string;
  detail: string | null;
  createdAt: string;
}

export interface AppGraphSummary {
  totalApps: number;
  activeApps: number;
  totalMonthlySpend: number;
  totalHighRiskScopes: number;
  appsByCategory: Record<string, number>;
  apps: App[];
}

export interface ComplianceFinding {
  id: string;
  rule: string;
  app: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  flaggedAt: string;
}

export interface ComplianceSummary {
  openFindings: number;
  highSeverity: number;
  mediumSeverity: number;
  lowSeverity: number;
  findings: ComplianceFinding[];
}

export interface ScanResult {
  scannedApps: number;
  totalFindings: number;
  highSeverity: number;
  mediumSeverity: number;
  lowSeverity: number;
  findings: {
    appId: string;
    appName: string;
    message: string;
    severity: string;
    ruleName: string;
  }[];
}

export interface ScoredApp {
  appId: string;
  appName: string;
  scores: { performance: number; cost: number; functionality: number; securityRisk: number };
  overallScore: number;
  recommendation: 'Keep' | 'Consolidate' | 'Replace' | 'Cut';
}

export interface Recommendation {
  appId: string;
  appName: string;
  decision: 'Keep' | 'Consolidate' | 'Replace' | 'Cut';
  rationale: string;
  savings: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependsOn?: string[];
}

export interface RemediationRoadmap {
  summary: {
    totalMonthlySpend: number;
    totalAnnualSpend: number;
    potentialSavings: number;
    redundantCategories: number;
    proposedActions: number;
  };
  costAnalysis: {
    totalMonthlySpend: number;
    totalAnnualSpend: number;
    topCostlyApps: { name: string; cost: number; handle: string }[];
    potentialSavings: number;
  };
  redundancyAnalysis: {
    category: string;
    apps: { id: string; name: string; monthlyCost: number | null }[];
    redundancyScore: number;
    recommendation: string;
    estimatedSavings: number;
  }[];
  proposedActions: {
    id: string;
    actionType: string;
    title: string;
    description: string | null;
    savings: number | null;
    status: string;
  }[];
}

export interface AIAnalysisResult {
  summary: string;
  recommendations: string[];
  confidence: number;
}

export interface VersionCompliance {
  shop: string;
  currentApiVersion: string;
  latestVersion: string;
  isCompliant: boolean;
  versionsBehind: number;
  recommendation: string;
  supportedVersions: string[];
}

export interface DataConflict {
  id: string;
  appIdOne: string;
  appIdTwo: string;
  conflictType: string;
  description: string;
  severity: string;
  status: string;
  createdAt: string;
  appOne?: { name: string; category: string | null };
  appTwo?: { name: string; category: string | null };
}

export interface StakeholderFeedbackItem {
  id: string;
  appId: string | null;
  app?: { name: string };
  submittedBy: string;
  role: string | null;
  response: string;
  severity: string;
  createdAt: string;
}

export interface FeedbackSummary {
  total: number;
  critical: number;
  warnings: number;
  byApp: Record<string, { count: number; critical: number }>;
  overrides: { appId: string; appName: string; response: string; severity: string }[];
  recent: StakeholderFeedbackItem[];
}

export interface EvidenceItem {
  id: string;
  eventType: string;
  action: string;
  details: string;
  actor: string | null;
  createdAt: string;
}

export interface AuditReport {
  summary: { totalEvents: number; byType: Record<string, number>; dateRange: { from: string; to: string } | null };
  evidence: EvidenceItem[];
}
