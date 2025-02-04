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
          blocking: true
          test_plan_short_ids: 'jgbinp,j1kn1,ocjmd' # Optional, comma-separated list of test plan short IDs
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `project_id` | Your QA.tech project ID | Yes | - |
| `api_token` | QA.tech API token | Yes | - |
| `api_url` | Custom API URL if needed | No | <https://app.qa.tech> |
| `test_plan_short_ids` | Comma-separated list of test plan IDs to run | No | - |
| `blocking` | Wait for test results before completing the workflow | No | false |

You can find your project ID and generate an API token in your [QA.tech project settings](https://app.qa.tech/dashboard/current-project/settings/integrations).

## Outputs

| Output | Description |
|--------|-------------|
| `run_created` | Whether the test run was created successfully on QA.tech |
| `run_short_id` | The short ID of the run. |
| `run_result` | The test execution result. Only set when blocking is true. |
| `run_status` | The final status of the run. Only set when blocking is true. |

### Blocking mode

When `blocking`is set to `true, the action will:

- Wait for all tests to complete execution
- Report the final test results before proceeding
- Fail the workflow step if any tests fail

### Test Plans

You can specify which test plans to run by providing their IDs in the `test_plan_short_ids` input. Multiple test plans should be separated by commas. For example:

```yaml
- uses: QAdottech/run-action@v1
  with:
    project_id: 'your-project-id'
    api_token: ${{ secrets.QATECH_API_TOKEN }}
    test_plan_short_ids: 'jgbinp,j1kn1,ocjmd'
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
