import { initializeDatabase, dbRun, dbGet } from './db';
import { initializeRepo, getGit, envToBranch, withGitLock } from './services/git';
import { logAudit, AuditActions } from './services/audit';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const REPO_PATH = process.env.CONFIG_REPO_PATH || path.join(PROJECT_ROOT, 'config-repo');

// Users to create
const users = [
  { id: 'user-admin', email: 'admin@confighub.local', password: 'admin123', role: 'admin' },
  { id: 'user-sarah', email: 'sarah.murphy@insureco.ie', password: 'demo123', role: 'approver' },
  { id: 'user-john', email: 'john.kelly@insureco.ie', password: 'demo123', role: 'editor' },
  { id: 'user-emma', email: 'emma.byrne@insureco.ie', password: 'demo123', role: 'viewer' },
];

// Config data - organized by domain
const configs: Record<string, Record<string, { dev: string; staging: string; prod: string }>> = {
  pricing: {
    'motor-rates': {
      dev: `# Motor Insurance Rates - Development
# Last updated: 2026-02-05
version: "2.4.0"

base_rates:
  car:
    comprehensive: 485.00
    third_party: 295.00
    third_party_fire_theft: 345.00
  motorcycle:
    comprehensive: 385.00
    third_party: 195.00
  van:
    comprehensive: 625.00
    third_party: 395.00

age_factors:
  17-20: 2.8    # Young driver surcharge increased
  21-25: 1.6
  26-35: 1.0
  36-50: 0.95
  51-65: 1.0
  66-75: 1.15
  76+: 1.45

no_claims_discount:
  1_year: 0.15
  2_years: 0.25
  3_years: 0.35
  4_years: 0.45
  5_years_plus: 0.55  # New: increased max discount

location_factors:
  dublin: 1.35
  cork: 1.15
  galway: 1.10
  limerick: 1.12
  waterford: 1.05
  rural: 0.90

# New feature in dev
telematics_discount:
  enabled: true
  max_discount: 0.30
  minimum_days: 30
`,
      staging: `# Motor Insurance Rates - Staging
# Last updated: 2026-02-01
version: "2.3.0"

base_rates:
  car:
    comprehensive: 475.00
    third_party: 285.00
    third_party_fire_theft: 335.00
  motorcycle:
    comprehensive: 375.00
    third_party: 185.00
  van:
    comprehensive: 615.00
    third_party: 385.00

age_factors:
  17-20: 2.5
  21-25: 1.5
  26-35: 1.0
  36-50: 0.95
  51-65: 1.0
  66-75: 1.15
  76+: 1.4

no_claims_discount:
  1_year: 0.15
  2_years: 0.25
  3_years: 0.35
  4_years: 0.45
  5_years_plus: 0.50

location_factors:
  dublin: 1.30
  cork: 1.15
  galway: 1.10
  limerick: 1.10
  waterford: 1.05
  rural: 0.90
`,
      prod: `# Motor Insurance Rates - Production
# Last updated: 2026-01-15
version: "2.2.0"

base_rates:
  car:
    comprehensive: 465.00
    third_party: 275.00
    third_party_fire_theft: 325.00
  motorcycle:
    comprehensive: 365.00
    third_party: 175.00
  van:
    comprehensive: 595.00
    third_party: 375.00

age_factors:
  17-20: 2.5
  21-25: 1.5
  26-35: 1.0
  36-50: 0.95
  51-65: 1.0
  66-75: 1.15
  76+: 1.4

no_claims_discount:
  1_year: 0.15
  2_years: 0.25
  3_years: 0.35
  4_years: 0.45
  5_years_plus: 0.50

location_factors:
  dublin: 1.25
  cork: 1.10
  galway: 1.05
  limerick: 1.05
  waterford: 1.0
  rural: 0.85
`,
    },
    'home-rates': {
      dev: `# Home Insurance Rates
version: "1.8.0"

base_rates:
  buildings_only: 285.00
  contents_only: 165.00
  buildings_and_contents: 395.00

property_type_factors:
  detached: 1.15
  semi_detached: 1.0
  terraced: 0.95
  apartment: 0.85
  bungalow: 1.05

alarm_discount:
  monitored: 0.15
  local: 0.08
  none: 0.0

claims_loading:
  0_claims: 1.0
  1_claim: 1.15
  2_claims: 1.35
  3_plus: 1.60
`,
      staging: `# Home Insurance Rates
version: "1.8.0"

base_rates:
  buildings_only: 285.00
  contents_only: 165.00
  buildings_and_contents: 395.00

property_type_factors:
  detached: 1.15
  semi_detached: 1.0
  terraced: 0.95
  apartment: 0.85
  bungalow: 1.05

alarm_discount:
  monitored: 0.15
  local: 0.08
  none: 0.0

claims_loading:
  0_claims: 1.0
  1_claim: 1.15
  2_claims: 1.35
  3_plus: 1.60
`,
      prod: `# Home Insurance Rates
version: "1.8.0"

base_rates:
  buildings_only: 285.00
  contents_only: 165.00
  buildings_and_contents: 395.00

property_type_factors:
  detached: 1.15
  semi_detached: 1.0
  terraced: 0.95
  apartment: 0.85
  bungalow: 1.05

alarm_discount:
  monitored: 0.15
  local: 0.08
  none: 0.0

claims_loading:
  0_claims: 1.0
  1_claim: 1.15
  2_claims: 1.35
  3_plus: 1.60
`,
    },
    'travel-rates': {
      dev: `# Travel Insurance Rates
version: "3.1.0"

destinations:
  europe:
    single_trip: 35.00
    annual: 89.00
  worldwide_excl_usa:
    single_trip: 55.00
    annual: 145.00
  worldwide_incl_usa:
    single_trip: 75.00
    annual: 195.00

age_bands:
  0-17: 0.5
  18-55: 1.0
  56-65: 1.35
  66-70: 1.75
  71-75: 2.25
  76-80: 3.0

cover_levels:
  basic:
    medical_limit: 1000000
    cancellation_limit: 2000
    baggage_limit: 1500
  standard:
    medical_limit: 5000000
    cancellation_limit: 5000
    baggage_limit: 2500
  premium:
    medical_limit: 10000000
    cancellation_limit: 10000
    baggage_limit: 5000

# New: COVID coverage
covid_cover:
  enabled: true
  additional_premium: 15.00
`,
      staging: `# Travel Insurance Rates
version: "3.0.0"

destinations:
  europe:
    single_trip: 32.00
    annual: 85.00
  worldwide_excl_usa:
    single_trip: 52.00
    annual: 140.00
  worldwide_incl_usa:
    single_trip: 72.00
    annual: 185.00

age_bands:
  0-17: 0.5
  18-55: 1.0
  56-65: 1.3
  66-70: 1.7
  71-75: 2.2
  76-80: 2.9

cover_levels:
  basic:
    medical_limit: 1000000
    cancellation_limit: 2000
    baggage_limit: 1500
  standard:
    medical_limit: 5000000
    cancellation_limit: 5000
    baggage_limit: 2500
  premium:
    medical_limit: 10000000
    cancellation_limit: 10000
    baggage_limit: 5000
`,
      prod: `# Travel Insurance Rates
version: "3.0.0"

destinations:
  europe:
    single_trip: 32.00
    annual: 85.00
  worldwide_excl_usa:
    single_trip: 52.00
    annual: 140.00
  worldwide_incl_usa:
    single_trip: 72.00
    annual: 185.00

age_bands:
  0-17: 0.5
  18-55: 1.0
  56-65: 1.3
  66-70: 1.7
  71-75: 2.2
  76-80: 2.9

cover_levels:
  basic:
    medical_limit: 1000000
    cancellation_limit: 2000
    baggage_limit: 1500
  standard:
    medical_limit: 5000000
    cancellation_limit: 5000
    baggage_limit: 2500
  premium:
    medical_limit: 10000000
    cancellation_limit: 10000
    baggage_limit: 5000
`,
    },
  },
  claims: {
    'processing-rules': {
      dev: `# Claims Processing Rules
version: "2.1.0"

auto_approve:
  enabled: true
  max_amount: 750  # Increased from 500
  eligible_claim_types:
    - windscreen
    - minor_damage
    - lost_keys
  excluded_postcodes: []

escalation:
  tier_1:
    max_amount: 5000
    approver_role: claims_handler
  tier_2:
    max_amount: 25000
    approver_role: senior_handler
  tier_3:
    max_amount: 100000
    approver_role: claims_manager
  tier_4:
    max_amount: null  # Unlimited
    approver_role: claims_director

fraud_detection:
  enabled: true
  velocity_check:
    max_claims_per_year: 3
    lookback_days: 365
  duplicate_check:
    enabled: true
    similarity_threshold: 0.85
`,
      staging: `# Claims Processing Rules
version: "2.0.0"

auto_approve:
  enabled: true
  max_amount: 500
  eligible_claim_types:
    - windscreen
    - minor_damage
    - lost_keys
  excluded_postcodes: []

escalation:
  tier_1:
    max_amount: 5000
    approver_role: claims_handler
  tier_2:
    max_amount: 25000
    approver_role: senior_handler
  tier_3:
    max_amount: 100000
    approver_role: claims_manager
  tier_4:
    max_amount: null
    approver_role: claims_director

fraud_detection:
  enabled: true
  velocity_check:
    max_claims_per_year: 3
    lookback_days: 365
  duplicate_check:
    enabled: true
    similarity_threshold: 0.85
`,
      prod: `# Claims Processing Rules
version: "2.0.0"

auto_approve:
  enabled: true
  max_amount: 500
  eligible_claim_types:
    - windscreen
    - minor_damage
    - lost_keys
  excluded_postcodes: []

escalation:
  tier_1:
    max_amount: 5000
    approver_role: claims_handler
  tier_2:
    max_amount: 25000
    approver_role: senior_handler
  tier_3:
    max_amount: 100000
    approver_role: claims_manager
  tier_4:
    max_amount: null
    approver_role: claims_director

fraud_detection:
  enabled: true
  velocity_check:
    max_claims_per_year: 3
    lookback_days: 365
  duplicate_check:
    enabled: true
    similarity_threshold: 0.85
`,
    },
    'notification-templates': {
      dev: `# Claim Notification Templates
version: "1.5.0"

templates:
  claim_received:
    subject: "Your claim {{claim_id}} has been received"
    channels: [email, sms, push]

  claim_approved:
    subject: "Good news! Your claim {{claim_id}} has been approved"
    channels: [email, sms]

  claim_rejected:
    subject: "Update on your claim {{claim_id}}"
    channels: [email]

  payment_sent:
    subject: "Payment sent for claim {{claim_id}}"
    channels: [email, sms, push]

  documents_required:
    subject: "Action needed: Documents required for claim {{claim_id}}"
    channels: [email, sms]

sms_settings:
  sender_id: "InsureCo"
  max_length: 160

email_settings:
  from_address: "claims@insureco.ie"
  reply_to: "support@insureco.ie"
`,
      staging: `# Claim Notification Templates
version: "1.5.0"

templates:
  claim_received:
    subject: "Your claim {{claim_id}} has been received"
    channels: [email, sms, push]

  claim_approved:
    subject: "Good news! Your claim {{claim_id}} has been approved"
    channels: [email, sms]

  claim_rejected:
    subject: "Update on your claim {{claim_id}}"
    channels: [email]

  payment_sent:
    subject: "Payment sent for claim {{claim_id}}"
    channels: [email, sms, push]

  documents_required:
    subject: "Action needed: Documents required for claim {{claim_id}}"
    channels: [email, sms]

sms_settings:
  sender_id: "InsureCo"
  max_length: 160

email_settings:
  from_address: "claims@insureco.ie"
  reply_to: "support@insureco.ie"
`,
      prod: `# Claim Notification Templates
version: "1.5.0"

templates:
  claim_received:
    subject: "Your claim {{claim_id}} has been received"
    channels: [email, sms, push]

  claim_approved:
    subject: "Good news! Your claim {{claim_id}} has been approved"
    channels: [email, sms]

  claim_rejected:
    subject: "Update on your claim {{claim_id}}"
    channels: [email]

  payment_sent:
    subject: "Payment sent for claim {{claim_id}}"
    channels: [email, sms, push]

  documents_required:
    subject: "Action needed: Documents required for claim {{claim_id}}"
    channels: [email, sms]

sms_settings:
  sender_id: "InsureCo"
  max_length: 160

email_settings:
  from_address: "claims@insureco.ie"
  reply_to: "support@insureco.ie"
`,
    },
  },
  integrations: {
    'payment-gateway': {
      dev: `# Payment Gateway Configuration
version: "1.2.0"

provider: stripe
environment: sandbox

endpoints:
  base_url: "https://api.stripe.com/v1"
  webhook_url: "https://dev.insureco.ie/webhooks/stripe"

settings:
  currency: EUR
  auto_capture: true
  statement_descriptor: "INSURECO IRELAND"

retry_policy:
  max_attempts: 3
  backoff_multiplier: 2
  initial_delay_ms: 1000

# Dev-only: Test mode
test_mode: true
test_card: "4242424242424242"
`,
      staging: `# Payment Gateway Configuration
version: "1.2.0"

provider: stripe
environment: sandbox

endpoints:
  base_url: "https://api.stripe.com/v1"
  webhook_url: "https://staging.insureco.ie/webhooks/stripe"

settings:
  currency: EUR
  auto_capture: true
  statement_descriptor: "INSURECO IRELAND"

retry_policy:
  max_attempts: 3
  backoff_multiplier: 2
  initial_delay_ms: 1000
`,
      prod: `# Payment Gateway Configuration
version: "1.1.0"

provider: stripe
environment: production

endpoints:
  base_url: "https://api.stripe.com/v1"
  webhook_url: "https://www.insureco.ie/webhooks/stripe"

settings:
  currency: EUR
  auto_capture: true
  statement_descriptor: "INSURECO IRELAND"

retry_policy:
  max_attempts: 5
  backoff_multiplier: 2
  initial_delay_ms: 500
`,
    },
    'crm-sync': {
      dev: `# CRM Synchronization Settings
version: "2.0.0"

provider: salesforce
sync_interval_minutes: 5

entities:
  customers:
    enabled: true
    direction: bidirectional
    conflict_resolution: crm_wins
  policies:
    enabled: true
    direction: outbound
  claims:
    enabled: true
    direction: outbound

field_mappings:
  customer:
    email: Email
    phone: Phone
    first_name: FirstName
    last_name: LastName
    address: BillingAddress

batch_settings:
  max_batch_size: 200
  parallel_batches: 4
`,
      staging: `# CRM Synchronization Settings
version: "2.0.0"

provider: salesforce
sync_interval_minutes: 5

entities:
  customers:
    enabled: true
    direction: bidirectional
    conflict_resolution: crm_wins
  policies:
    enabled: true
    direction: outbound
  claims:
    enabled: true
    direction: outbound

field_mappings:
  customer:
    email: Email
    phone: Phone
    first_name: FirstName
    last_name: LastName
    address: BillingAddress

batch_settings:
  max_batch_size: 200
  parallel_batches: 4
`,
      prod: `# CRM Synchronization Settings
version: "2.0.0"

provider: salesforce
sync_interval_minutes: 5

entities:
  customers:
    enabled: true
    direction: bidirectional
    conflict_resolution: crm_wins
  policies:
    enabled: true
    direction: outbound
  claims:
    enabled: true
    direction: outbound

field_mappings:
  customer:
    email: Email
    phone: Phone
    first_name: FirstName
    last_name: LastName
    address: BillingAddress

batch_settings:
  max_batch_size: 200
  parallel_batches: 4
`,
    },
  },
  documents: {
    'policy-templates': {
      dev: `# Policy Document Templates
version: "4.2.0"

templates:
  motor_policy:
    template_id: "TPL-MOT-2026"
    languages: [en, ga]
    sections:
      - cover_summary
      - vehicle_details
      - driver_details
      - exclusions
      - claims_procedure

  home_policy:
    template_id: "TPL-HOM-2026"
    languages: [en, ga]
    sections:
      - cover_summary
      - property_details
      - contents_schedule
      - exclusions
      - claims_procedure

  travel_policy:
    template_id: "TPL-TRV-2026"
    languages: [en]
    sections:
      - cover_summary
      - trip_details
      - medical_cover
      - exclusions
      - emergency_contacts

generation:
  format: pdf
  compression: true
  digital_signature: true

storage:
  provider: s3
  bucket: insureco-documents-dev
  retention_years: 7
`,
      staging: `# Policy Document Templates
version: "4.1.0"

templates:
  motor_policy:
    template_id: "TPL-MOT-2026"
    languages: [en, ga]
    sections:
      - cover_summary
      - vehicle_details
      - driver_details
      - exclusions
      - claims_procedure

  home_policy:
    template_id: "TPL-HOM-2026"
    languages: [en, ga]
    sections:
      - cover_summary
      - property_details
      - contents_schedule
      - exclusions
      - claims_procedure

generation:
  format: pdf
  compression: true
  digital_signature: true

storage:
  provider: s3
  bucket: insureco-documents-staging
  retention_years: 7
`,
      prod: `# Policy Document Templates
version: "4.0.0"

templates:
  motor_policy:
    template_id: "TPL-MOT-2025"
    languages: [en, ga]
    sections:
      - cover_summary
      - vehicle_details
      - driver_details
      - exclusions
      - claims_procedure

  home_policy:
    template_id: "TPL-HOM-2025"
    languages: [en, ga]
    sections:
      - cover_summary
      - property_details
      - contents_schedule
      - exclusions
      - claims_procedure

generation:
  format: pdf
  compression: true
  digital_signature: true

storage:
  provider: s3
  bucket: insureco-documents-prod
  retention_years: 7
`,
    },
  },
  feature_flags: {
    'features': {
      dev: `# Feature Flags
version: "1.0.0"
updated: "2026-02-05"

flags:
  new_quote_engine:
    enabled: true
    description: "New React-based quote engine"
    rollout_percentage: 100

  telematics_integration:
    enabled: true
    description: "IoT telematics device integration"
    rollout_percentage: 100

  instant_claims:
    enabled: true
    description: "AI-powered instant claims assessment"
    rollout_percentage: 50
    eligible_claim_types: [windscreen, minor_damage]

  multi_currency:
    enabled: true
    description: "Support for GBP payments"
    rollout_percentage: 100

  dark_mode:
    enabled: true
    description: "Customer portal dark mode"
    rollout_percentage: 100

  chatbot_v2:
    enabled: true
    description: "New AI chatbot with Claude"
    rollout_percentage: 25
`,
      staging: `# Feature Flags
version: "1.0.0"
updated: "2026-02-01"

flags:
  new_quote_engine:
    enabled: true
    description: "New React-based quote engine"
    rollout_percentage: 100

  telematics_integration:
    enabled: true
    description: "IoT telematics device integration"
    rollout_percentage: 75

  instant_claims:
    enabled: true
    description: "AI-powered instant claims assessment"
    rollout_percentage: 25
    eligible_claim_types: [windscreen]

  multi_currency:
    enabled: false
    description: "Support for GBP payments"
    rollout_percentage: 0

  dark_mode:
    enabled: true
    description: "Customer portal dark mode"
    rollout_percentage: 100
`,
      prod: `# Feature Flags
version: "1.0.0"
updated: "2026-01-20"

flags:
  new_quote_engine:
    enabled: true
    description: "New React-based quote engine"
    rollout_percentage: 100

  telematics_integration:
    enabled: false
    description: "IoT telematics device integration"
    rollout_percentage: 0

  instant_claims:
    enabled: false
    description: "AI-powered instant claims assessment"
    rollout_percentage: 0

  multi_currency:
    enabled: false
    description: "Support for GBP payments"
    rollout_percentage: 0

  dark_mode:
    enabled: true
    description: "Customer portal dark mode"
    rollout_percentage: 50
`,
    },
  },
};

async function writeConfigToEnv(env: string, domain: string, key: string, content: string) {
  await withGitLock(async () => {
    const g = getGit();
    const branch = envToBranch(env);
    const currentBranch = (await g.branchLocal()).current;

    try {
      await g.checkout(branch);

      const domainPath = path.join(REPO_PATH, 'config', domain);
      const filePath = path.join(domainPath, `${key}.yaml`);

      if (!fs.existsSync(domainPath)) {
        fs.mkdirSync(domainPath, { recursive: true });
      }

      fs.writeFileSync(filePath, content, 'utf-8');

      await g.add('.');
      await g.commit(`seed: Add ${domain}/${key} to ${env}`);
    } finally {
      await g.checkout(currentBranch);
    }
  });
}

async function seed() {
  console.log('Starting seed process...\n');

  // Initialize
  await initializeDatabase();
  await initializeRepo();

  // Clear existing data
  console.log('Clearing existing data...');
  await dbRun('DELETE FROM audit_log');
  await dbRun('DELETE FROM promotion_requests');
  await dbRun('DELETE FROM change_requests');
  await dbRun('DELETE FROM sessions');
  await dbRun('DELETE FROM users');

  // Create users
  console.log('\nCreating users...');
  for (const user of users) {
    const passwordHash = bcrypt.hashSync(user.password, 10);
    await dbRun(
      'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [user.id, user.email, passwordHash, user.role]
    );
    console.log(`  Created: ${user.email} (${user.role})`);
  }

  // Write configs to all environments
  console.log('\nWriting configurations...');
  for (const [domain, keys] of Object.entries(configs)) {
    for (const [key, envContent] of Object.entries(keys)) {
      for (const [env, content] of Object.entries(envContent)) {
        await writeConfigToEnv(env, domain, key, content);
        console.log(`  ${env}/${domain}/${key}`);
      }
    }
  }

  // Create some change requests
  console.log('\nCreating change requests...');

  const changeRequests = [
    {
      id: 'CR-001',
      branch_name: 'draft/CR-001',
      target_environment: 'dev',
      domain: 'pricing',
      key_name: 'pet-rates',
      operation: 'create',
      title: 'Add pet insurance rates',
      description: 'Initial pet insurance pricing configuration',
      status: 'draft',
      created_by: 'user-john',
    },
    {
      id: 'CR-002',
      branch_name: 'draft/CR-002',
      target_environment: 'dev',
      domain: 'claims',
      key_name: 'processing-rules',
      operation: 'update',
      title: 'Increase auto-approve threshold',
      description: 'Raising the auto-approve limit from €500 to €750 to reduce manual processing',
      status: 'pending_review',
      created_by: 'user-john',
    },
    {
      id: 'CR-003',
      branch_name: 'draft/CR-003',
      target_environment: 'dev',
      domain: 'integrations',
      key_name: 'analytics',
      operation: 'create',
      title: 'Add analytics integration config',
      description: 'Google Analytics 4 configuration for customer portal',
      status: 'approved',
      created_by: 'user-sarah',
      reviewed_by: 'user-admin',
    },
  ];

  for (const cr of changeRequests) {
    await dbRun(
      `INSERT INTO change_requests (id, branch_name, target_environment, domain, key_name, operation, title, description, status, created_by, reviewed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cr.id, cr.branch_name, cr.target_environment, cr.domain, cr.key_name, cr.operation, cr.title, cr.description, cr.status, cr.created_by, cr.reviewed_by || null]
    );
    console.log(`  ${cr.id}: ${cr.title} (${cr.status})`);
  }

  // Create promotion requests
  console.log('\nCreating promotion requests...');

  const promotions = [
    {
      id: 'PR-101',
      source_env: 'dev',
      target_env: 'staging',
      domain: 'pricing',
      files: JSON.stringify(['motor-rates']),
      status: 'pending',
      requested_by: 'user-john',
      notes: 'Q1 2026 rate adjustments ready for staging validation',
    },
    {
      id: 'PR-102',
      source_env: 'staging',
      target_env: 'prod',
      domain: 'claims',
      files: JSON.stringify(['notification-templates']),
      status: 'approved',
      requested_by: 'user-sarah',
      reviewed_by: 'user-admin',
      notes: 'Updated notification templates - approved by compliance',
    },
    {
      id: 'PR-103',
      source_env: 'dev',
      target_env: 'staging',
      domain: 'feature_flags',
      files: JSON.stringify(['features']),
      status: 'promoted',
      requested_by: 'user-john',
      reviewed_by: 'user-sarah',
      notes: 'Enable telematics feature flag in staging',
      commit_sha: 'abc123def',
    },
  ];

  for (const pr of promotions) {
    await dbRun(
      `INSERT INTO promotion_requests (id, source_env, target_env, domain, files, status, requested_by, reviewed_by, notes, commit_sha)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pr.id, pr.source_env, pr.target_env, pr.domain, pr.files, pr.status, pr.requested_by, pr.reviewed_by || null, pr.notes, pr.commit_sha || null]
    );
    console.log(`  ${pr.id}: ${pr.domain} ${pr.source_env}→${pr.target_env} (${pr.status})`);
  }

  // Create audit log entries
  console.log('\nCreating audit log entries...');

  await logAudit('user-admin', AuditActions.AUTH_LOGIN, 'user', 'user-admin', null, null, { email: 'admin@confighub.local' });
  await logAudit('user-john', AuditActions.AUTH_LOGIN, 'user', 'user-john', null, null, { email: 'john.kelly@insureco.ie' });
  await logAudit('user-sarah', AuditActions.AUTH_LOGIN, 'user', 'user-sarah', null, null, { email: 'sarah.murphy@insureco.ie' });

  await logAudit('user-john', AuditActions.CHANGE_REQUEST_CREATED, 'change_request', 'CR-001', 'dev', 'pricing', { title: 'Add pet insurance rates' });
  await logAudit('user-john', AuditActions.CHANGE_REQUEST_CREATED, 'change_request', 'CR-002', 'dev', 'claims', { title: 'Increase auto-approve threshold' });
  await logAudit('user-john', AuditActions.CHANGE_REQUEST_SUBMITTED, 'change_request', 'CR-002', 'dev', 'claims', { title: 'Increase auto-approve threshold' });

  await logAudit('user-sarah', AuditActions.CHANGE_REQUEST_CREATED, 'change_request', 'CR-003', 'dev', 'integrations', { title: 'Add analytics integration config' });
  await logAudit('user-sarah', AuditActions.CHANGE_REQUEST_SUBMITTED, 'change_request', 'CR-003', 'dev', 'integrations', { title: 'Add analytics integration config' });
  await logAudit('user-admin', AuditActions.CHANGE_REQUEST_APPROVED, 'change_request', 'CR-003', 'dev', 'integrations', { title: 'Add analytics integration config' });

  await logAudit('user-john', AuditActions.PROMOTION_CREATED, 'promotion', 'PR-101', 'staging', 'pricing', { sourceEnv: 'dev', files: ['motor-rates'] });
  await logAudit('user-sarah', AuditActions.PROMOTION_CREATED, 'promotion', 'PR-102', 'prod', 'claims', { sourceEnv: 'staging', files: ['notification-templates'] });
  await logAudit('user-admin', AuditActions.PROMOTION_APPROVED, 'promotion', 'PR-102', 'prod', 'claims', { sourceEnv: 'staging' });

  await logAudit('user-john', AuditActions.PROMOTION_CREATED, 'promotion', 'PR-103', 'staging', 'feature_flags', { sourceEnv: 'dev', files: ['features'] });
  await logAudit('user-sarah', AuditActions.PROMOTION_APPROVED, 'promotion', 'PR-103', 'staging', 'feature_flags', { sourceEnv: 'dev' });
  await logAudit('user-john', AuditActions.PROMOTION_EXECUTED, 'promotion', 'PR-103', 'staging', 'feature_flags', { sourceEnv: 'dev', files: ['features'] }, 'abc123def');

  console.log('  Created 15 audit entries');

  // Create dependencies
  console.log('\nCreating dependencies...');
  await dbRun('DELETE FROM dependencies');

  const dependencies = [
    {
      id: 'dep-001',
      app_name: 'Motor Pricing Engine',
      app_id: 'motor-pricing-engine',
      environment: 'prod',
      domain: 'pricing',
      config_keys: JSON.stringify(['motor-rates']),
      contact_email: 'pricing-team@insureco.ie',
      contact_team: 'Pricing',
      last_heartbeat: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    },
    {
      id: 'dep-002',
      app_name: 'MuleSoft Doc API',
      app_id: 'mulesoft-doc-api',
      environment: 'prod',
      domain: 'documents',
      config_keys: JSON.stringify(['policy-templates']),
      contact_email: 'integration@insureco.ie',
      contact_team: 'Integration',
      last_heartbeat: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    },
    {
      id: 'dep-003',
      app_name: 'Broker Portal',
      app_id: 'broker-portal',
      environment: 'prod',
      domain: 'pricing',
      config_keys: JSON.stringify(['motor-rates', 'home-rates', 'travel-rates']),
      contact_email: 'broker-team@insureco.ie',
      contact_team: 'Broker Services',
      last_heartbeat: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
    },
    {
      id: 'dep-004',
      app_name: 'Motor Pricing Engine',
      app_id: 'motor-pricing-engine',
      environment: 'staging',
      domain: 'pricing',
      config_keys: JSON.stringify(['motor-rates']),
      contact_email: 'pricing-team@insureco.ie',
      contact_team: 'Pricing',
      last_heartbeat: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
    },
    {
      id: 'dep-005',
      app_name: 'Claims Processor',
      app_id: 'claims-processor',
      environment: 'prod',
      domain: 'claims',
      config_keys: JSON.stringify(['processing-rules', 'notification-templates']),
      contact_email: 'claims@insureco.ie',
      contact_team: 'Claims',
      last_heartbeat: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago
    },
    {
      id: 'dep-006',
      app_name: 'Customer Portal',
      app_id: 'customer-portal',
      environment: 'prod',
      domain: 'feature_flags',
      config_keys: JSON.stringify(['features']),
      contact_email: 'portal@insureco.ie',
      contact_team: 'Digital',
      last_heartbeat: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago (inactive)
    },
  ];

  for (const dep of dependencies) {
    await dbRun(
      `INSERT INTO dependencies (id, app_name, app_id, environment, domain, config_keys, contact_email, contact_team, last_heartbeat)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dep.id, dep.app_name, dep.app_id, dep.environment, dep.domain, dep.config_keys, dep.contact_email, dep.contact_team, dep.last_heartbeat]
    );
    console.log(`  ${dep.app_name} (${dep.environment}/${dep.domain})`);
  }

  console.log('\n✅ Seed complete!\n');
  console.log('Demo accounts:');
  console.log('  admin@confighub.local / admin123 (admin)');
  console.log('  sarah.murphy@insureco.ie / demo123 (approver)');
  console.log('  john.kelly@insureco.ie / demo123 (editor)');
  console.log('  emma.byrne@insureco.ie / demo123 (viewer)');
  console.log('\nDrift status:');
  console.log('  - pricing/motor-rates: Different across all envs');
  console.log('  - pricing/travel-rates: Dev differs from staging/prod');
  console.log('  - claims/processing-rules: Dev differs from staging/prod');
  console.log('  - documents/policy-templates: All different');
  console.log('  - feature_flags/features: All different');
  console.log('  - Several configs fully synced');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
