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
          project_short_id: 'your-project-short-id'
          api_token: ${{ secrets.QATECH_API_TOKEN }}
          test_plan_short_id: 'jgbinp'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `project_short_id` | Your QA.tech project short ID | Yes | - |
| `api_token` | QA.tech API token | Yes | - |
| `api_url` | Custom API URL if needed | No | <https://app.qa.tech> |
| `test_plan_short_id` | Test plan short ID to run | No | - |
| `blocking` | Enables blocking mode to wait for the test run to complete | No | false |
| `applications_config` | JSON string containing application environment overrides | No | - |

You can find your project short ID and generate an API token in your [QA.tech project settings](https://app.qa.tech/dashboard/current-project/settings/integrations).

## Outputs

| Output | Description |
|--------|-------------|
| `run_created` | Whether the test run was created successfully on QA.tech |
| `run_status` | The final status of the run (INITIATED, RUNNING, COMPLETED, ERROR, or CANCELLED). Only set when blocking is true |
| `run_result` | The test execution result (PASSED, FAILED, or SKIPPED). Only set when blocking is true |
| `run_short_id` | The short ID of the run |
| `run_url` | The URL of the run |

## Test Plan

Specify which test plan to run by providing its ID in the test_plan_short_id input. To run multiple test plans, simply use the GitHub Action multiple times in your workflow.

For example:

```yaml
- uses: QAdottech/run-action@v2
  with:
    project_short_id: 'your-project-short-id'
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
    project_short_id: 'your-project-short-id'
    api_token: ${{ secrets.QATECH_API_TOKEN }}
    blocking: true
```

When blocking is enabled, the action provides additional outputs:

- `run_status`: The final status of the run (INITIATED, RUNNING, COMPLETED, ERROR, or CANCELLED)
- `run_result`: The test execution result (PASSED, FAILED, or SKIPPED)

## Application Environment Overrides

You can override application environments for specific runs using the `applications_config` input. This is useful for testing against preview deployments or specific environment URLs.

The input expects a JSON string with the following format:

```json
{
  "applications": {
    "appId": {
      "environment": {
        "url": "https://preview-123.vercel.app",
        "name": "Preview Environment"
      }
    }
  }
}
```

### Example Usage

```yaml
- uses: QAdottech/run-action@v2
  with:
    project_short_id: 'your-project-short-id'
    api_token: ${{ secrets.QATECH_API_TOKEN }}
    test_plan_short_id: 'jgbinp'
    applications_config: |
      {
        "applications": {
          "short-id-1": {
            "environment": {
              "url": "https://preview-123-hackoffice.vercel.app"
            }
          }
        }
      }
```

You can override multiple applications in a single run:

> **Note**: Check on app.qa.tech under Test Plans → API Integration to see which applications are connected to your test plan.

```yaml
applications_config: |
  {
    "applications": {
      "short-id-2": {
        "environment": {
          "url": "https://preview-123-hackoffice.vercel.app",
          "name": "PR-123"
        }
      },
      "short-id-2": {
        "environment": {
          "url": "https://preview-123-saas.vercel.app",
          "name": "PR-123"
        }
      }
    }
  }
```

## Change Review

In addition to running test plans, this repo exposes a second action at `QAdottech/run-action/change-review` that calls QA.tech's `POST /v1/chat/change-review` endpoint to perform an autonomous change review of a GitHub pull request.

### Usage

```yaml
name: QA.tech Change Review
on:
  pull_request:

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: QAdottech/run-action/change-review@v2
        with:
          project_short_id: 'your-project-short-id'
          api_token: ${{ secrets.QATECH_API_TOKEN }}
          applications_config: |
            {
              "applications": {
                "app_ONdgMD": {
                  "environment": {
                    "url": "https://preview-${{ github.event.number }}.example.com"
                  }
                }
              }
            }
          blocking: true
```

When invoked on a `pull_request` event the action automatically uses the event's PR URL. To review a different pull request, pass `pr_url` explicitly.

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `project_short_id` | Your QA.tech project short ID. | Yes | - |
| `api_token` | QA.tech API token. | Yes | - |
| `applications_config` | JSON of `{ "applications": { appId: { "environment": {...} } } }`. Every entry must include an `environment` (one of `url` / `shortId` / `applicationBuildShortId`). | Yes | - |
| `api_url` | Custom API URL if needed. | No | `https://api.qa.tech` |
| `blocking` | Wait for the assistant reply and expose it as an output. | No | `false` |
| `context` | Free-form context appended to the review. | No | - |
| `pr_url` | Pull request URL to review. Defaults to the PR URL of the current `pull_request` event. | No | - |

### Outputs

| Output | Description |
|--------|-------------|
| `chat_created` | Whether the change review chat was created. |
| `chat_short_id` | Short ID of the change review chat conversation. |
| `chat_url` | Dashboard URL of the chat. |
| `chat_status` | Final status of the assistant message (`COMPLETED`, `FAILED`, or `CANCELLED`). Only set when `blocking` is true. |
| `chat_response` | The assistant's reply text. Only set when `blocking` is true. |

When `blocking: true` the action polls `GET /v1/chat/{chat_short_id}` every 20 seconds until the latest assistant message reaches `COMPLETED`, `FAILED`, or `CANCELLED`. `FAILED` and `CANCELLED` will fail the workflow step.

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
