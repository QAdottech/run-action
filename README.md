# QA.tech GitHub Action

This action integrates your GitHub workflow with QA.tech, triggering test runs automatically when configured events occur.

## Usage

```yaml
name: QA.tech Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: qatech/run-action@v1
        with:
          project_id: 'your-project-id'
          api_token: ${{ secrets.QATECH_API_TOKEN }}
          api_url: 'https://custom.qa.tech' # Optional, defaults to https://app.qa.tech
          test_plan_ids: 'plan1,plan2,plan3' # Optional, comma-separated list of test plan IDs
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `project_id` | Your QA.tech project ID | Yes | - |
| `api_token` | QA.tech API token | Yes | - |
| `test_plan_ids` | Comma-separated list of test plan short IDs to run | No | - |

## Outputs

| Output | Description |
|--------|-------------|
| `runId` | The ID of the created test run |
| `runShortId` | A short ID for the test run |
| `success` | Boolean indicating if the run was successful |

## Test Plans

You can specify which test plans to run by providing their IDs in the `test_plan_ids` input. Multiple test plans should be separated by commas. For example:

```yaml
- uses: qatech/run-action@v1
  with:
    project_id: 'your-project-id'
    api_token: ${{ secrets.QATECH_API_TOKEN }}
    test_plan_ids: 'plan1,plan2,plan3'
```

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build

# Lint
pnpm lint
```

## License

MIT
