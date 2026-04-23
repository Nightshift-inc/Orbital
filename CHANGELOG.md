# Changelog

All notable changes to Orbital are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed
- Migrated auth-service session handling from Bearer header to signed cookies (#847)
- Log rotation interval reduced from 24h to 6h in auth-service (#845)
- Refactored token caching layer in auth-service (#844)

### Added
- Rate limiting headers on all gateway responses (#841)
- Idempotency key support on payment charge endpoint (#833)
- ULID-based session IDs in auth-service (#835)

## [0.14.0] - 2026-04-07

### Changed
- Upgraded payment client library to v3.2 (#843)

### Fixed
- CORS allowlist tightened to documented client origins (#827)

## [0.13.0] - 2026-03-31

### Added
- Metrics endpoint on auth-service for Prometheus scraping (#821)

### Changed
- Session store connection pooling reduced reconnect churn under load (#820)
