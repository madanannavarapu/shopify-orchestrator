-- Run this in Supabase SQL Editor to create all tables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core: Shop / Tenant
CREATE TABLE "Shop" (
    id TEXT PRIMARY KEY,
    myshopifyDomain TEXT UNIQUE NOT NULL,
    accessToken TEXT NOT NULL,
    installedAt TIMESTAMPTZ DEFAULT NOW(),
    lastActivityAt TIMESTAMPTZ DEFAULT NOW(),
    apiVersion TEXT DEFAULT '2024-10',
    billingPlan TEXT DEFAULT 'free',
    tenantTier TEXT DEFAULT 'standard',
    tenantPolicies TEXT,
    storeMetadata TEXT
);

-- Tenant Policy
CREATE TABLE "TenantPolicy" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopId TEXT NOT NULL REFERENCES "Shop"(id) ON DELETE CASCADE,
    policyType TEXT NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    isActive BOOLEAN DEFAULT true,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- App
CREATE TABLE "App" (
    id TEXT PRIMARY KEY,
    shopId TEXT NOT NULL REFERENCES "Shop"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    handle TEXT NOT NULL,
    installedAt TIMESTAMPTZ DEFAULT NOW(),
    lastUsedAt TIMESTAMPTZ,
    isActive BOOLEAN DEFAULT true,
    category TEXT,
    monthlyCost FLOAT,
    billingInterval TEXT,
    developerName TEXT,
    performanceScore INT,
    recommendation TEXT,
    themeAssets TEXT,
    ownerName TEXT,
    ownerEmail TEXT,
    ownerPurpose TEXT,
    reviewCadence TEXT,
    lastReviewedAt TIMESTAMPTZ,
    nextReviewAt TIMESTAMPTZ,
    UNIQUE(shopId, handle)
);

-- App Score History
CREATE TABLE "AppScoreHistory" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appId TEXT NOT NULL REFERENCES "App"(id) ON DELETE CASCADE,
    performance INT,
    cost INT,
    functionality INT,
    securityRisk INT,
    overallScore FLOAT,
    recommendation TEXT,
    scoredBy TEXT,
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- App Permission
CREATE TABLE "AppPermission" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appId TEXT NOT NULL REFERENCES "App"(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    isHighRisk BOOLEAN DEFAULT false,
    UNIQUE(appId, scope)
);

-- App Event
CREATE TABLE "AppEvent" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appId TEXT NOT NULL REFERENCES "App"(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    detail TEXT,
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Bulk Operation
CREATE TABLE "BulkOperation" (
    id TEXT PRIMARY KEY,
    shopId TEXT NOT NULL REFERENCES "Shop"(id) ON DELETE CASCADE,
    queryType TEXT NOT NULL,
    status TEXT DEFAULT 'CREATED',
    objectCount INT,
    url TEXT,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    completedAt TIMESTAMPTZ,
    errorCode TEXT
);

-- Compliance Rule
CREATE TABLE "ComplianceRule" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopId TEXT NOT NULL REFERENCES "Shop"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    condition TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    isActive BOOLEAN DEFAULT true,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance Finding
CREATE TABLE "ComplianceFinding" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ruleId UUID NOT NULL REFERENCES "ComplianceRule"(id) ON DELETE CASCADE,
    appId TEXT NOT NULL REFERENCES "App"(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    flaggedAt TIMESTAMPTZ DEFAULT NOW(),
    resolvedAt TIMESTAMPTZ,
    approvedBy TEXT,
    approvedAt TIMESTAMPTZ
);

-- Remediation Action
CREATE TABLE "RemediationAction" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopId TEXT NOT NULL,
    appId TEXT,
    actionType TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    savings FLOAT,
    status TEXT DEFAULT 'proposed',
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    approvedAt TIMESTAMPTZ,
    approvedBy TEXT
);

-- Stakeholder Feedback
CREATE TABLE "StakeholderFeedback" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopId TEXT NOT NULL REFERENCES "Shop"(id) ON DELETE CASCADE,
    appId TEXT REFERENCES "App"(id) ON DELETE SET NULL,
    submittedBy TEXT NOT NULL,
    role TEXT,
    question TEXT NOT NULL,
    response TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance Evidence (immutable audit log)
CREATE TABLE "ComplianceEvidence" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopId TEXT NOT NULL REFERENCES "Shop"(id) ON DELETE CASCADE,
    eventType TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    actor TEXT,
    immutable BOOLEAN DEFAULT true,
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Page Speed Result
CREATE TABLE "PageSpeedResult" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopId TEXT NOT NULL REFERENCES "Shop"(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    performance FLOAT,
    accessibility FLOAT,
    bestPractices FLOAT,
    seo FLOAT,
    fullJson TEXT,
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- App Page Speed Impact
CREATE TABLE "AppPageSpeedImpact" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appId TEXT NOT NULL REFERENCES "App"(id) ON DELETE CASCADE,
    pageSpeedId UUID NOT NULL REFERENCES "PageSpeedResult"(id) ON DELETE CASCADE,
    performanceHit FLOAT,
    score INT,
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Data Conflict
CREATE TABLE "DataConflict" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopId TEXT NOT NULL REFERENCES "Shop"(id) ON DELETE CASCADE,
    appIdOne TEXT NOT NULL REFERENCES "App"(id) ON DELETE CASCADE,
    appIdTwo TEXT NOT NULL REFERENCES "App"(id) ON DELETE CASCADE,
    conflictType TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    resolvedAt TIMESTAMPTZ
);

-- Agent Execution
CREATE TABLE "AgentExecution" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopId TEXT NOT NULL,
    agentType TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    input TEXT,
    output TEXT,
    prompts TEXT,
    toolCalls TEXT,
    latencyMs INT,
    costUsd FLOAT,
    error TEXT,
    startedAt TIMESTAMPTZ DEFAULT NOW(),
    completedAt TIMESTAMPTZ,
    parentExecutionId TEXT
);

-- Incident
CREATE TABLE "Incident" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopId TEXT NOT NULL REFERENCES "Shop"(id) ON DELETE CASCADE,
    incidentType TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    source TEXT,
    status TEXT DEFAULT 'open',
    assignedTo TEXT,
    detectedAt TIMESTAMPTZ DEFAULT NOW(),
    resolvedAt TIMESTAMPTZ,
    resolution TEXT
);

-- Incident Escalation
CREATE TABLE "IncidentEscalation" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incidentId UUID NOT NULL REFERENCES "Incident"(id) ON DELETE CASCADE,
    escalatedTo TEXT NOT NULL,
    reason TEXT NOT NULL,
    escalatedAt TIMESTAMPTZ DEFAULT NOW(),
    respondedAt TIMESTAMPTZ,
    response TEXT
);

-- Theme Cleanup Verification
CREATE TABLE "ThemeCleanupVerification" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appId TEXT NOT NULL REFERENCES "App"(id) ON DELETE CASCADE,
    assetType TEXT NOT NULL,
    assetPath TEXT NOT NULL,
    isPresent BOOLEAN DEFAULT true,
    verifiedAt TIMESTAMPTZ DEFAULT NOW(),
    cleanRemoved BOOLEAN DEFAULT false
);

-- Vendor Negotiation
CREATE TABLE "VendorNegotiation" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopId TEXT NOT NULL REFERENCES "Shop"(id) ON DELETE CASCADE,
    appId TEXT REFERENCES "App"(id) ON DELETE SET NULL,
    vendorName TEXT NOT NULL,
    currentCost FLOAT,
    proposedCost FLOAT,
    savings FLOAT,
    status TEXT DEFAULT 'draft',
    message TEXT,
    draftText TEXT,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    sentAt TIMESTAMPTZ,
    acceptedAt TIMESTAMPTZ
);

-- Query Router Cache
CREATE TABLE "QueryRouterCache" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopId TEXT NOT NULL,
    queryHash TEXT NOT NULL,
    queryType TEXT NOT NULL,
    response TEXT,
    ttlSeconds INT DEFAULT 300,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    expiresAt TIMESTAMPTZ NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_app_shop ON "App"(shopId);
CREATE INDEX idx_finding_app ON "ComplianceFinding"(appId);
CREATE INDEX idx_finding_status ON "ComplianceFinding"(status);
CREATE INDEX idx_evidence_shop ON "ComplianceEvidence"(shopId);
CREATE INDEX idx_evidence_type ON "ComplianceEvidence"(eventType);
CREATE INDEX idx_incident_shop ON "Incident"(shopId);
CREATE INDEX idx_incident_status ON "Incident"(status);
CREATE INDEX idx_agent_execution_shop ON "AgentExecution"(shopId);
CREATE INDEX idx_query_cache_hash ON "QueryRouterCache"(queryHash);

-- Enable Row Level Security on all tables
ALTER TABLE "Shop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "App" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComplianceEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Incident" ENABLE ROW LEVEL SECURITY;
