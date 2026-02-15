ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'qualified';
ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'operational_review';
ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'trial_run';
ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'account_active';
ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'retention';