# Validation record

Validated 24 September 2026 against the built application in an isolated local environment. This record does **not** establish a public deployment.

- TypeScript check and Vite production build: passed.
- Analytical tests: 7 passed.
- Real HTTP integration tests: 13 passed.
- Clean Chromium browser workflows: 14 passed.
- Browser JavaScript exceptions: 0.
- Responsive check: 390 px mobile viewport, no document overflow.
- PDF: generated/downloaded through the real API, text and SHA-256 verified; all 12 pages visually reviewed.
- Database persistence: verified after restarting the API process.
- Demo session isolation: separate visitors cannot access one another's custom cases or reports.

## Browser workflow results

| Workflow | Result |
| --- | --- |
| Clean browser opens the landing page and enters a demo session | Passed |
| Flagship investigation traces 47 transfers and displays consistent candidate intelligence | Passed |
| Transaction graph supports node, edge, zoom, cluster and path interactions | Passed |
| Attribution evidence opens linked transactions and records audit metadata | Passed |
| TRACE AI produces case-grounded citations and refuses unsupported evidence | Passed |
| Investigator exports a real PDF and timeline includes report generation | Passed |
| Related complaint navigation follows an actual linked case | Passed |
| Command palette searches stored evidence and navigates to its case | Passed |
| Wallet search has useful empty results and opens actual stored wallet intelligence | Passed |
| Alert review and dismissal persist through reload | Passed |
| Case creation validates the wallet and persists a newly traced investigation | Passed |
| Information request preparation keeps the selected case and downloads an unsent package | Passed |
| Every intelligence and operations page renders without an application error | Passed |
| Mobile landing, dashboard and investigation remain readable without document overflow | Passed |

## Tested corrections

Transaction ingestion updates wallet metrics and re-tracing preserves imported evidence. TRACE AI evidence citations open the relevant evidence dialog; related-case citations navigate to that case. Information-request preparation preserves the selected case and downloads an unsent JSON package.

## Boundaries

Public HTTPS hosting and a second-device public check were blocked by administrator-disabled hosting integrations. Docker is not available in the build environment, so the supplied image definition was not built here. Tests establish application behavior and synthetic evidence consistency; they do not validate live-chain coverage, real entity attribution, operational security certification, or trained fraud-model accuracy.

## Reproduction

See [test instructions](../tests/README.md) and [deployment instructions](DEPLOYMENT.md). The source includes automated tests, a compiled frontend, and a sample PDF; install dependencies and provide the documented Python runtime for a source or container deployment.
