# Angular

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.27.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Issuance portal service API

The portal only talks to the issuance portal service, under `/issuance-portal/api/v1` on the tenant host. Its TypeScript clients are generated from the contracts in `api/` before every build and test run (`npm run api:generate`), with openapi-generator in Docker, so Docker must be running. The generated code lives in `src/app/core/api/generated/` and is not committed.

The contracts are maintained in `eudistack-platform-dev` (`docs/02_discovery/features/`), one per module of the service: Journey and Authentic source. After a contract changes there, copy them again:

```bash
npm run api:sync            # from ../eudistack-platform-dev
npm run api:sync -- <path>  # from another checkout
```

### Mock of the API

Until the service has every endpoint, you can run a mock built from the contracts:

```bash
npm run mock:api
```

It starts one Prism per contract and a proxy on `http://localhost:4000/issuance-portal/api/v1`. To use it from the local stack, point the `/issuance-portal/api/v1/` location of `local-env/nginx/default.conf.template` in `eudistack-platform-dev` to `http://host.docker.internal:4000` and restart nginx. `GET /config` answers, like the service, by the tenant of the host: `mock/portal-config.<tenant>.json` (only `cgcom` is included), or 503 `config_unavailable` when the tenant has no file. The file is read on every request, so you can edit it without restarting. Set `MOCK_API_CONFIG` to force one file for every tenant, or to `unavailable` to always get 503. The other endpoints come from Prism, which makes up values from the schemas. They require a Bearer Access Token, which the portal gets from the Verifier login (EUD-314); until then the proxy adds a test token (`MOCK_API_TOKEN`, `mock-token` by default) to the calls that carry none.

With the issuance portal service running in the local stack (its nginx route sends `/issuance-portal/api/v1/` to `issuance-portal-service`), the portal can use the real `GET /config` instead of the mock.

The brand and the languages do not come from the API: the portal reads them from `/assets/tenants/{tenant}/theme.json`, served by nginx from `eudistack-platform-assets`.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
