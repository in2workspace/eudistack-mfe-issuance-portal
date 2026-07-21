# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added

- **Tenant-configured issuance entry point (EUD-165)** — after identification the
  portal selects and starts the entry point (`WITH_VALIDATION` / `DIRECT`)
  configured per tenant via runtime `env.js`, fail-closed when the configuration
  is missing or invalid, with a safe no-op when the downstream target is not yet
  set.

