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
          project_id: "your-project-id"
          api_token: ${{ secrets.QATECH_API_TOKEN }}
          test_plan_short_id: "jgbinp"
```

## Inputs

| Input                  | Description                                                | Required | Default               |
| ---------------------- | ---------------------------------------------------------- | -------- | --------------------- |
| `project_id`           | Your QA.tech project ID                                    | Yes      | -                     |
| `api_token`            | QA.tech API token                                          | Yes      | -                     |
| `api_url`              | Custom API URL if needed                                   | No       | <https://app.qa.tech> |
| `test_plan_short_id`   | Test plan short ID to run                                  | No       | -                     |
| `blocking`             | Enables blocking mode to wait for the test run to complete | No       | false                 |
| `applications_config`  | JSON string containing application environment overrides   | No       | -                     |
| `exploratory`          | Enable exploratory testing mode using AI agents            | No       | false                 |
| `exploratory_prompt`   | Prompt describing what to test during exploratory testing  | No       | -                     |
| `notifications_config` | JSON string containing notification settings               | No       | -                     |

You can find your project ID and generate an API token in your [QA.tech project settings](https://app.qa.tech/dashboard/current-project/settings/integrations).

## Outputs

| Output         | Description                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| `run_created`  | Whether the test run was created successfully on QA.tech                                                         |
| `run_status`   | The final status of the run (INITIATED, RUNNING, COMPLETED, ERROR, or CANCELLED). Only set when blocking is true |
| `run_result`   | The test execution result (PASSED, FAILED, or SKIPPED). Only set when blocking is true                           |
| `run_short_id` | The short ID of the run                                                                                          |
| `run_url`      | The URL of the run                                                                                               |

## Test Plan

Specify which test plan to run by providing its ID in the test_plan_short_id input. To run multiple test plans, simply use the GitHub Action multiple times in your workflow.

For example:

```yaml
- uses: QAdottech/run-action@v2
  with:
    project_id: "your-project-id"
    api_token: ${{ secrets.QATECH_API_TOKEN }}
    test_plan_short_id: "jgbinp"
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
    project_id: "your-project-id"
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
    project_id: "your-project-id"
    api_token: ${{ secrets.QATECH_API_TOKEN }}
    test_plan_short_id: "jgbinp"
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

## Exploratory Testing

The action supports exploratory testing using QA.tech's AI agents. This allows you to test applications with natural language prompts instead of predefined test plans.

### How it Works

When you enable `exploratory: true` and provide an `exploratory_prompt`, the action will:

1. Trigger an exploratory test run on QA.tech
2. The AI agent will navigate to the URL specified in `applications_config`
3. Follow the instructions in your prompt to test the application
4. Optionally send notifications based on your `notifications_config`

### Basic Exploratory Testing

```yaml
- uses: QAdottech/run-action@v2
  with:
    project_id: "your-project-id"
    api_token: ${{ secrets.QATECH_API_TOKEN }}
    exploratory: true
    exploratory_prompt: "Test the following changes: service: api-auth: refactor verification email flow"
    applications_config: |
      {
        "applications": {
          "frontend-app-id": {
            "environment": {
              "url": "https://your-app.com",
              "name": "Test Environment"
            }
          }
        }
      }
    blocking: true
```

### Exploratory Testing with Notifications

To automatically send notifications when tests complete:

```yaml
- uses: QAdottech/run-action@v2
  with:
    project_id: "your-project-id"
    api_token: ${{ secrets.QATECH_API_TOKEN }}
    exploratory: true
    exploratory_prompt: "Test the checkout flow and payment processing"
    applications_config: |
      {
        "applications": {
          "frontend-app-id": {
            "environment": {
              "url": "https://your-app.com",
              "name": "Test Environment"
            }
          }
        }
      }
    notifications_config: |
      [
        {
          "type": "github-comment",
          "pr_number": ${{ github.event.number }},
          "send_on": ["COMPLETED"],
          "silent_on": ["PASSED"]
        }
      ]
    blocking: true
```

### Complete Workflow Example

Here's a complete GitHub Actions workflow that triggers exploratory testing on pull requests:

```yaml
name: Exploratory Testing

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  exploratory-test:
    runs-on: ubuntu-latest
    steps:
      - name: Run Exploratory Tests
        uses: QAdottech/run-action@v2
        with:
          project_id: ${{ secrets.QATECH_PROJECT_ID }}
          api_token: ${{ secrets.QATECH_API_TOKEN }}
          exploratory: true
          exploratory_prompt: |
            Test the following changes:
            service: api-auth: refactor verification email flow
            service: web-frontend: add support for new email verification flow endpoints
            service: web-frontend: list all forgotten password recovery attempts in settings
          applications_config: |
            {
              "applications": {
                "frontend-app": {
                  "environment": {
                    "url": "https://preview-${{ github.event.number }}-frontend.vercel.app",
                    "name": "PR-${{ github.event.number }}-Frontend"
                  }
                },
                "backend-api": {
                  "environment": {
                    "url": "https://preview-${{ github.event.number }}-api.vercel.app",
                    "name": "PR-${{ github.event.number }}-API"
                  }
                }
              }
            }
          notifications_config: |
            [
              {
                "type": "github-comment",
                "pr_number": ${{ github.event.number }},
                "send_on": ["COMPLETED"],
                "silent_on": ["PASSED"]
              }
            ]
          blocking: true
```

### Example Prompts

Here are some example prompts you can use for exploratory testing:

- **Service Changes**: "Test the following changes: service: api-auth: refactor verification email flow"
- **E-commerce**: "Test the product search functionality, add items to cart, and complete the checkout process"
- **Authentication**: "Test user registration, login, password reset, and account verification flows"
- **Dashboard**: "Navigate through all menu items, test data visualization, and verify export functionality"
- **Forms**: "Fill out the contact form with various data combinations and test validation"
- **Mobile**: "Test the responsive design on different screen sizes and touch interactions"

### Notification Configuration

The `notifications_config` parameter allows you to configure multiple notification types:

```json
[
	{
		"type": "github-comment",
		"pr_number": 123,
		"send_on": ["COMPLETED"],
		"silent_on": ["PASSED"]
	},
	{
		"type": "email",
		"recipient": "team@company.com",
		"send_on": ["FAILED"],
		"silent_on": ["PASSED"]
	},
	{
		"type": "webhook",
		"url": "https://hooks.slack.com/services/...",
		"send_on": ["STARTED", "COMPLETED"],
		"silent_on": ["PASSED"]
	}
]
```

#### Notification Types

- **`github-comment`**: Posts a comment on a GitHub PR
  - `pr_number`: The PR number to comment on
- **`email`**: Sends an email notification (planned)
  - `recipient`: Email address to send to
- **`webhook`**: Sends a webhook notification (planned)
  - `url`: Webhook URL to send to

#### Notification Triggers

- **`send_on`**: Array of statuses when to send notifications
  - `STARTED`: When the test run begins
  - `COMPLETED`: When the test run finishes
  - `FAILED`: When the test run fails
- **`silent_on`**: Array of results to suppress notifications for
  - `PASSED`: Don't notify when tests pass
  - `FAILED`: Don't notify when tests fail
  - `SKIPPED`: Don't notify when tests are skipped

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
