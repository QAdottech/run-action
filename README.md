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

| Input                 | Description                                                                           | Required | Default               |
| --------------------- | ------------------------------------------------------------------------------------- | -------- | --------------------- |
| `project_id`          | Your QA.tech project ID                                                               | Yes      | -                     |
| `api_token`           | QA.tech API token                                                                     | Yes      | -                     |
| `api_url`             | Custom API URL if needed                                                              | No       | <https://app.qa.tech> |
| `test_plan_short_id`  | Test plan short ID to run                                                             | No       | -                     |
| `blocking`            | Enables blocking mode to wait for the test run to complete                            | No       | false                 |
| `applications_config` | JSON string containing application environment overrides                              | No       | -                     |
| `exploratory_url`     | URL to start exploratory testing on. When provided, triggers exploratory testing mode | No       | -                     |
| `exploratory_prompt`  | Prompt describing what to test during exploratory testing                             | No       | -                     |
| `github_pr_number`    | GitHub PR number to comment on once exploratory testing is complete                   | No       | -                     |
| `github_token`        | GitHub token for posting PR comments. Defaults to GITHUB_TOKEN environment variable   | No       | -                     |

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

When you provide both `exploratory_url` and `exploratory_prompt`, the action will:

1. Trigger an exploratory test run on QA.tech
2. The AI agent will navigate to the specified URL
3. Follow the instructions in your prompt to test the application
4. Optionally post results as a comment on a GitHub PR

### Basic Exploratory Testing

```yaml
- uses: QAdottech/run-action@v2
  with:
    project_id: "your-project-id"
    api_token: ${{ secrets.QATECH_API_TOKEN }}
    exploratory_url: "https://your-app.com"
    exploratory_prompt: "Test the login functionality with different user roles and verify the dashboard loads correctly"
    blocking: true
```

### Exploratory Testing with PR Comments

To automatically post test results to a GitHub PR:

```yaml
- uses: QAdottech/run-action@v2
  with:
    project_id: "your-project-id"
    api_token: ${{ secrets.QATECH_API_TOKEN }}
    exploratory_url: "https://your-app.com"
    exploratory_prompt: "Test the checkout flow and payment processing"
    github_pr_number: ${{ github.event.number }}
    github_token: ${{ secrets.GITHUB_TOKEN }}
    blocking: true
```

### Example Prompts

Here are some example prompts you can use for exploratory testing:

- **E-commerce**: "Test the product search functionality, add items to cart, and complete the checkout process"
- **Authentication**: "Test user registration, login, password reset, and account verification flows"
- **Dashboard**: "Navigate through all menu items, test data visualization, and verify export functionality"
- **Forms**: "Fill out the contact form with various data combinations and test validation"
- **Mobile**: "Test the responsive design on different screen sizes and touch interactions"

### PR Comment Format

When `github_pr_number` is provided, the action will post a formatted comment with:

- Test status (PASSED/FAILED/SKIPPED)
- The URL that was tested
- The prompt that was used
- Link to detailed results on QA.tech
- Visual indicators (✅/❌/⚠️)

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
