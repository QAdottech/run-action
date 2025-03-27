# QA.tech GitHub Action

This action integrates your GitHub workflow with QA.tech, triggering test runs automatically when configured events occur.

## Usage

```yaml
name: QA.tech Tests
on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: QAdottech/run-action@v1
        with:
          project_id: 'your-project-id'
          api_token: ${{ secrets.QATECH_API_TOKEN }}
          test_plan_short_id: 'jgbinp' # Optional, test plan short ID
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `project_id` | Your QA.tech project ID | Yes | - |
| `api_token` | QA.tech API token | Yes | - |
| `api_url` | Custom API URL if needed | No | <https://app.qa.tech> |
| `test_plan_short_id` | Test plan short ID to run | No | - |
| `blocking` | Enables blocking mode to wait for the test run to complete | No | false |

You can find your project ID and generate an API token in your [QA.tech project settings](https://app.qa.tech/dashboard/current-project/settings/integrations).

## Outputs

| Output | Description |
|--------|-------------|
| `runId` | The ID of the created test run |
| `runShortId` | A short ID for the test run |
| `success` | Boolean indicating if the run was successful |

## Test Plan

Specify which test plan to run by providing its ID in the test_plan_short_id input. To run multiple test plans, simply use the GitHub Action multiple times in your workflow.

For example:

```yaml
- uses: QAdottech/run-action@v2
  with:
    project_id: 'your-project-id'
    api_token: ${{ secrets.QATECH_API_TOKEN }}
    test_plan_short_id: 'jgbinp'
```

## Blocking

The action supports a blocking mode that will wait for the test run to complete before proceeding. When enabled, the action will:

1. Create the test run
2. Poll the run status until completion
3. Set additional outputs with the final status and result
4. Fail the GitHub Action if the test run fails

To enable blocking mode, set the `blocking` input to `true`:

```yaml
- uses: QAdottech/run-action@v2
  with:
    project_id: 'your-project-id'
    api_token: ${{ secrets.QATECH_API_TOKEN }}
    blocking: true
```

When blocking is enabled, the action provides additional outputs:

- `run_status`: The final status of the run (INITIATED, RUNNING, COMPLETED, ERROR, or CANCELLED)
- `run_result`: The test execution result (PASSED, FAILED, or SKIPPED)

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
