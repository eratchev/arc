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
  {
    title: 'URL Shortener',
    category: 'web_services',
    difficulty: 'easy' as const,
    description:
      'Design a URL shortening service like TinyURL or bit.ly. Users submit a long URL and receive a short, ' +
      'unique alias that redirects to the original. The system must handle high read throughput (100:1 read-to-write ratio), ' +
      'generate short links that are globally unique, and support optional custom aliases and link expiration. ' +
      'Handle 500 million new URLs per month and 50 billion redirects per month.',
    constraints: [
      '500 million new URLs/month',
      '50 billion redirects/month (100:1 read:write)',
      'Short URLs must be 7 characters or fewer',
      'Links should expire after configurable TTL',
      'Custom aliases supported',
      '99.99% redirect availability',
    ],
    expected_components: [
      'Base62 or hashing for short code generation',
      'Key-value store for URL mappings',
      'Cache layer (Redis/Memcached) for hot URLs',
      'Load balancer',
      'Analytics/click tracking',
      'TTL-based expiration with cleanup',
      'Collision detection/resolution',
      'Database sharding strategy',
    ],
    time_limit_min: 35,
  },
  {
    title: 'Distributed Rate Limiter',
    category: 'infrastructure',
    difficulty: 'medium' as const,
    description:
      'Design an API rate limiter that works across a distributed fleet of servers. The rate limiter must enforce ' +
      'per-user and per-API-key limits (e.g., 100 requests/minute) with minimal latency overhead. ' +
      'It should support multiple rate limiting algorithms (fixed window, sliding window, token bucket) ' +
      'and return accurate rate limit headers. Handle 100,000 unique clients making 1 million requests/second total.',
    constraints: [
      '1 million requests/second across the fleet',
      '100,000 unique clients',
      'Sub-1ms latency overhead per request',
      'Consistent enforcement across multiple servers',
      'Accurate rate limit headers (remaining, reset)',
      'Configurable per-endpoint and per-client limits',
    ],
    expected_components: [
      'Distributed counter store (Redis)',
      'Sliding window or token bucket algorithm',
      'Rate limit configuration service',
      'Local cache with sync for hot paths',
      'Rate limit header generation',
      'Graceful degradation (allow vs deny on failure)',
      'Dashboard for monitoring and configuration',
      'Client identification (API key, IP, user ID)',
    ],
    time_limit_min: 40,
  },
  {
    title: 'Real-Time Chat System',
    category: 'messaging',
    difficulty: 'medium' as const,
    description:
      'Design a real-time messaging system like Slack or WhatsApp. The system supports 1:1 messages, group chats ' +
      '(up to 500 members), message persistence, read receipts, and online presence indicators. Users should receive ' +
      'messages within 200ms. Support 10 million concurrent connections and 500,000 messages/second. ' +
      'Messages must be stored durably and searchable.',
    constraints: [
      '10 million concurrent connections',
      '500,000 messages/second',
      'Sub-200ms message delivery',
      'Group chats up to 500 members',
      'Message persistence and search',
      'Read receipts and typing indicators',
      'Online/offline presence',
    ],
    expected_components: [
      'WebSocket gateway with connection management',
      'Message queue for async delivery',
      'Chat service with group management',
      'Message storage (Cassandra/ScyllaDB)',
      'Presence service',
      'Push notification service',
      'Search index (Elasticsearch)',
      'Fan-out strategy for group messages',
      'Message ordering and deduplication',
      'Media/file attachment storage (S3)',
    ],
    time_limit_min: 50,
  },
  {
    title: 'Content Delivery Network',
    category: 'infrastructure',
    difficulty: 'hard' as const,
    description:
      'Design a CDN that serves static and dynamic content to users worldwide with minimal latency. ' +
      'The system must cache content at edge locations, handle cache invalidation, and fall back to origin servers. ' +
      'Support 1 million requests/second across 50+ edge locations, with P99 latency under 50ms for cached content. ' +
      'Handle cache stampedes, partial content delivery, and origin shielding.',
    constraints: [
      '1 million requests/second globally',
      '50+ edge locations',
      'P99 latency < 50ms for cache hits',
      'Cache invalidation within 30 seconds',
      'Support range requests and streaming',
      '99.99% availability',
    ],
    expected_components: [
      'Edge servers with local cache (SSD + RAM)',
      'DNS-based or Anycast routing',
      'Origin shield layer',
      'Cache invalidation via pub/sub',
      'Consistent hashing for cache distribution',
      'Health checking and failover',
      'TLS termination at edge',
      'Request collapsing for cache stampedes',
      'Analytics and real-time monitoring',
      'Configuration propagation system',
    ],
    time_limit_min: 55,
  },
  {
    title: 'Ride-Sharing Service',
    category: 'location_services',
    difficulty: 'hard' as const,
    description:
      'Design a ride-sharing platform like Uber or Lyft. The system must match riders with nearby drivers in real-time, ' +
      'track driver locations continuously, compute ETAs, handle surge pricing, and process payments. ' +
      'Support 1 million active drivers and 10 million ride requests/day across multiple cities. ' +
      'Driver-rider matching must complete within 5 seconds.',
    constraints: [
      '1 million active drivers sending location updates',
      '10 million ride requests/day',
      'Match rider to driver within 5 seconds',
      'Real-time location tracking (every 3 seconds)',
      'Dynamic/surge pricing',
      'Multi-city support with different regulations',
    ],
    expected_components: [
      'Location service with geospatial index (H3/S2)',
      'Matching/dispatch service',
      'ETA computation engine',
      'Surge pricing service',
      'Trip management service',
      'Payment processing service',
      'Real-time tracking via WebSockets',
      'Driver/rider notification service',
      'Supply-demand heatmap',
      'Event sourcing for trip lifecycle',
    ],
    time_limit_min: 55,
  },
  {
    title: 'Distributed Task Scheduler',
    category: 'infrastructure',
    difficulty: 'medium' as const,
    description:
      'Design a distributed task scheduler that executes jobs at specified times or intervals. The system supports ' +
      'one-time scheduled tasks, recurring cron-like jobs, and task dependencies (DAGs). ' +
      'It must guarantee at-least-once execution, handle worker failures, and support priorities. ' +
      'Handle 10 million scheduled tasks with 100,000 executions/minute at peak.',
    constraints: [
      '10 million scheduled tasks',
      '100,000 executions/minute at peak',
      'At-least-once execution guarantee',
      'Sub-second scheduling accuracy',
      'Task dependency support (DAGs)',
      'Configurable retry policies per task',
    ],
    expected_components: [
      'Task store (database with time-based indexing)',
      'Scheduler service with leader election',
      'Worker pool with heartbeat monitoring',
      'Task queue with priority support',
      'DAG resolver for dependencies',
      'Dead letter queue for failed tasks',
      'Idempotency layer',
      'Monitoring dashboard',
      'Task result storage',
      'Cron expression parser',
    ],
    time_limit_min: 45,
  },
  {
    title: 'Video Streaming Platform',
    category: 'media',
    difficulty: 'hard' as const,
    description:
      'Design a video streaming platform like YouTube or Netflix. The system handles video upload, transcoding into ' +
      'multiple resolutions and formats, storage, and adaptive bitrate streaming to millions of concurrent viewers. ' +
      'Support 500 hours of video uploaded per minute and 1 billion video views per day. ' +
      'Videos must be available for streaming within 10 minutes of upload.',
    constraints: [
      '500 hours of video uploaded/minute',
      '1 billion views/day',
      'Available for streaming within 10 minutes of upload',
      'Adaptive bitrate streaming (240p to 4K)',
      'Global delivery with minimal buffering',
      'Support for subtitles and multiple audio tracks',
    ],
    expected_components: [
      'Upload service with resumable uploads',
      'Object storage for raw and processed video',
      'Transcoding pipeline (GPU workers)',
      'CDN for video delivery',
      'Adaptive bitrate streaming (HLS/DASH)',
      'Metadata service',
      'Thumbnail generation service',
      'Recommendation engine',
      'View count and analytics service',
      'Content moderation pipeline',
    ],
    time_limit_min: 55,
  },
  {
    title: 'Notification Service',
    category: 'messaging',
    difficulty: 'easy' as const,
    description:
      'Design a notification service that delivers messages across multiple channels: push notifications, email, SMS, ' +
      'and in-app. The system must support user preferences (opt-in/out per channel), template management, ' +
      'rate limiting to prevent spam, and delivery tracking. Handle 1 billion notifications/day with priority levels ' +
      'and guaranteed delivery for critical alerts.',
    constraints: [
      '1 billion notifications/day',
      'Multiple channels (push, email, SMS, in-app)',
      'User preference management',
      'Rate limiting per user per channel',
      'Priority levels (critical, high, normal, low)',
      'Delivery tracking and analytics',
    ],
    expected_components: [
      'Notification ingestion API',
      'Priority queue per channel',
      'Template rendering engine',
      'Channel adapters (APNS, FCM, SES, Twilio)',
      'User preference store',
      'Rate limiter per user',
      'Delivery status tracking',
      'Retry mechanism per channel',
      'Analytics pipeline',
      'Unsubscribe/preference management API',
    ],
    time_limit_min: 40,
  },
  {
    title: 'Web Crawler',
    category: 'data_processing',
    difficulty: 'medium' as const,
    description:
      'Design a web crawler that systematically downloads and indexes billions of web pages. The crawler must be ' +
      'politeness-aware (respect robots.txt, rate limits per domain), handle deduplication of URLs and content, ' +
      'and prioritize pages by importance. Support crawling 1 billion pages per week with freshness guarantees ' +
      'for high-priority domains.',
    constraints: [
      '1 billion pages/week',
      'Respect robots.txt and crawl-delay',
      'URL and content deduplication',
      'Priority-based crawl scheduling',
      'Handle traps (infinite URLs, dynamic pages)',
      'Freshness: re-crawl top sites within 24 hours',
    ],
    expected_components: [
      'URL frontier with priority queue',
      'DNS resolver with caching',
      'HTTP fetcher with connection pooling',
      'robots.txt parser and cache',
      'URL deduplication (Bloom filter)',
      'Content deduplication (SimHash)',
      'HTML parser and link extractor',
      'Distributed crawl scheduler',
      'Page storage (object store)',
      'Monitoring and politeness enforcement',
    ],
    time_limit_min: 45,
  },
  {
    title: 'Payment Processing System',
    category: 'fintech',
    difficulty: 'hard' as const,
    description:
      'Design a payment processing system like Stripe. The system handles payment intents, processes charges via ' +
      'multiple payment processors, manages refunds, and ensures exactly-once processing of transactions. ' +
      'Support 10,000 transactions/second with PCI DSS compliance. Handle partial failures, idempotency, ' +
      'and reconciliation with external processors.',
    constraints: [
      '10,000 transactions/second',
      'PCI DSS compliance',
      'Exactly-once processing guarantee',
      'Multi-currency support',
      'Sub-2-second payment processing',
      '99.999% availability for payment processing',
    ],
    expected_components: [
      'Payment intent state machine',
      'Idempotency key store',
      'Payment processor adapters',
      'Transaction ledger (double-entry)',
      'Fraud detection service',
      'Refund processing pipeline',
      'Reconciliation engine',
      'PCI-compliant card vault',
      'Webhook delivery for status updates',
      'Audit logging',
    ],
    time_limit_min: 55,
  },
  {
    title: 'Typeahead / Autocomplete Service',
    category: 'search',
    difficulty: 'easy' as const,
    description:
      'Design a typeahead suggestion service that provides real-time search suggestions as users type. ' +
      'The system must return the top 10 suggestions within 100ms based on query prefix, popularity, and personalization. ' +
      'Support 100,000 queries/second with a dictionary of 5 billion possible suggestions. ' +
      'Suggestions should update as trending queries change.',
    constraints: [
      '100,000 queries/second',
      'P99 latency < 100ms',
      '5 billion possible suggestions',
      'Top 10 results ranked by popularity',
      'Trending suggestions updated in near-real-time',
      'Support for multiple languages',
    ],
    expected_components: [
      'Trie or prefix tree data structure',
      'Distributed trie across nodes',
      'Ranking service (popularity, recency, personalization)',
      'Sampling pipeline for popularity tracking',
      'Cache layer for hot prefixes',
      'Data collection pipeline (search logs)',
      'Offline trie builder (MapReduce)',
      'Replication for availability',
    ],
    time_limit_min: 35,
  },
  {
    title: 'Stock Exchange',
    category: 'fintech',
    difficulty: 'hard' as const,
    description:
      'Design a stock exchange matching engine that processes buy and sell orders in real-time. The system maintains ' +
      'an order book per security, matches orders using price-time priority, and broadcasts trade executions ' +
      'to all subscribers. Support 1 million orders/second with sub-millisecond matching latency. ' +
      'Ensure fairness, consistency, and regulatory audit trails.',
    constraints: [
      '1 million orders/second',
      'Sub-millisecond matching latency',
      'Price-time priority matching',
      'Strict ordering guarantees',
      'Real-time market data broadcasting',
      'Full audit trail for regulatory compliance',
    ],
    expected_components: [
      'Order book per security (sorted price levels)',
      'Matching engine (price-time priority)',
      'Sequencer for strict ordering',
      'Market data feed (multicast/WebSocket)',
      'Order gateway with validation',
      'Risk management / pre-trade checks',
      'Trade reporting and settlement',
      'Audit log (append-only ledger)',
      'Partition by security for horizontal scale',
      'Hot standby for failover',
    ],
    time_limit_min: 55,
  },
];

async function seed() {
  console.log('Seeding prompts...');
  const db = createAdminDb();

  for (const prompt of SEED_PROMPTS) {
    await db
      .insert(prompts)
      .values(prompt)
      .onConflictDoNothing({ target: prompts.title });
    console.log(`  Seeded: ${prompt.title}`);
  }

  console.log('Done!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
