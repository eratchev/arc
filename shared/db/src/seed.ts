import { createAdminDb } from './client';
import { prompts } from './schema/sds';

const SEED_PROMPTS = [
  {
    title: 'Webhook Reliability System',
    category: 'webhook_reliability',
    difficulty: 'medium' as const,
    description:
      'Design a webhook delivery system that guarantees at-least-once delivery to thousands of endpoints. ' +
      'The system receives events from internal services and must deliver them to external customer-configured URLs. ' +
      'Consider failure scenarios: endpoint downtime, slow responses, invalid SSL certificates, and rate limiting. ' +
      'The system should handle 10,000 events/second at peak with 99.9% delivery success within 5 minutes.',
    constraints: [
      'At-least-once delivery guarantee',
      '10,000 events/second throughput',
      '99.9% delivery within 5 minutes',
      'Customer-configurable retry policies',
      'Must not overwhelm slow endpoints',
    ],
    expected_components: [
      'Message queue (Kafka/SQS/RabbitMQ)',
      'Worker pool with backpressure',
      'Retry mechanism with exponential backoff',
      'Dead letter queue',
      'Circuit breaker per endpoint',
      'Delivery status tracking',
      'Rate limiter per endpoint',
      'Idempotency keys',
    ],
    time_limit_min: 45,
  },
  {
    title: 'AI Document Extraction Pipeline',
    category: 'ai_extraction',
    difficulty: 'hard' as const,
    description:
      'Design a document processing pipeline that extracts structured data from unstructured business documents ' +
      '(invoices, contracts, compliance forms). The system receives documents via API upload, runs them through ' +
      'OCR and LLM extraction, validates results against schemas, and stores structured output. ' +
      'Handle 50,000 documents/day with varying complexity. Some documents need human review when confidence is low.',
    constraints: [
      '50,000 documents/day throughput',
      'Sub-60-second processing for simple documents',
      'Human-in-the-loop for low-confidence extractions',
      'Schema validation for extracted data',
      'Audit trail for all extractions',
      'Support for 20+ document types',
    ],
    expected_components: [
      'Document ingestion API',
      'Object storage (S3) for raw documents',
      'OCR service (Textract/Google Vision)',
      'LLM extraction service',
      'Confidence scoring',
      'Human review queue',
      'Schema validation layer',
      'Structured data store',
      'Pipeline orchestrator (Step Functions/Temporal)',
      'Monitoring and alerting',
    ],
    time_limit_min: 60,
  },
  {
    title: 'Middesk-style Business Verification Platform',
    category: 'compliance_verification',
    difficulty: 'hard' as const,
    description:
      'Design a business identity verification platform that aggregates data from multiple government and commercial ' +
      'sources to verify business legitimacy. When a customer submits a business for verification, the system must ' +
      'query Secretary of State databases, IRS records, commercial data providers, and web presence. ' +
      'Results are compiled into a unified verification report with confidence scores. ' +
      'Handle 5,000 verification requests/day with SLA of 24 hours for full reports.',
    constraints: [
      '5,000 verifications/day',
      '24-hour SLA for complete reports',
      'Real-time status updates to customers',
      'Graceful degradation when sources are unavailable',
      'Data freshness requirements vary by source',
      'SOC 2 compliance required',
    ],
    expected_components: [
      'Provider orchestration layer',
      'Provider adapters (SOS, IRS, commercial)',
      'Caching layer with TTL per source',
      'Report aggregation engine',
      'Confidence scoring model',
      'Webhook notifications',
      'Rate limiting per provider',
      'Circuit breaker per provider',
      'Retry with provider-specific backoff',
      'Audit logging',
      'Data encryption at rest',
    ],
    time_limit_min: 60,
  },
  {
    title: 'Provider Orchestration Engine',
    category: 'provider_orchestration',
    difficulty: 'medium' as const,
    description:
      'Design a provider orchestration system that routes requests to multiple third-party API providers ' +
      'with automatic failover, load balancing, and cost optimization. The system sits between your application ' +
      'and 5-10 providers that offer similar services (e.g., identity verification, payment processing). ' +
      'It should select the best provider based on cost, latency, reliability history, and feature support. ' +
      'Handle 1,000 requests/second with 99.95% availability.',
    constraints: [
      '1,000 requests/second',
      '99.95% availability',
      'Sub-200ms routing decision',
      'Automatic failover within 5 seconds',
      'Cost optimization across providers',
      'Provider-specific rate limits respected',
    ],
    expected_components: [
      'Router/load balancer',
      'Provider health monitoring',
      'Circuit breaker per provider',
      'Cost tracking and optimization',
      'Request/response normalization layer',
      'Fallback chain configuration',
      'Latency-based routing',
      'Provider credential management',
      'Observability (metrics, traces, logs)',
      'Configuration management (feature flags)',
    ],
    time_limit_min: 45,
  },
];

async function seed() {
  console.log('Seeding prompts...');
  const db = createAdminDb();

  for (const prompt of SEED_PROMPTS) {
    await db
      .insert(prompts)
      .values(prompt)
      .onConflictDoNothing();
    console.log(`  Seeded: ${prompt.title}`);
  }

  console.log('Done!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
