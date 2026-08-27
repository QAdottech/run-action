# QA.tech GitHub Action

**Dynamic PR testing with AI agents.** Point this action at a pull request and its preview deployment, and QA.tech's agents actually use your product the way a user would — clicking through the flows your diff touches, hunting for regressions, and reporting back before a human opens the review.

No selectors. No test scripts to maintain. No access to your code required.

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

That's the whole setup. On a `pull_request` event the action picks up the PR URL from the event payload automatically — pass `pr_url` if you want to review a different pull request. Your project short ID and API token come from your [QA.tech project settings](https://app.qa.tech/dashboard/current-project/settings/integrations), and application short IDs live under Test Plans → API Integration.

---

## Change Review

When a pull request opens, the action hands QA.tech the PR URL and the preview environment to test against. From there the agents:

- **Read the diff** and work out what behaviour could have changed.
- **Exercise your preview deployment** — real browser, real flows, vision-based rather than DOM-based, so a refactor or a component library upgrade doesn't produce a false failure.
- **Explore around the change** for regressions your own suite wouldn't have thought to cover.
- **Report a verdict anchored to the diff**, so pre-existing failures are called out separately instead of blocking your PR.

The result is a review that tells you whether the change *works*, not just whether it compiles — and it lands before your teammates spend time on it.

### Point it at your preview deployment

The whole value of Change Review is that it runs against the code in the PR, so `applications_config` is required. Each application needs an `environment`, and you can identify that environment three ways:

| Field | Use it when |
|-------|-------------|
| `url` | You have a preview URL for the PR (Vercel, Netlify, Render, your own ephemeral env). Add an optional `name` to label the run. |
| `shortId` | You want to reuse an environment already configured in QA.tech, such as staging. |
| `applicationBuildShortId` | You want to test a specific uploaded build. |

Multiple applications in one review — useful when a PR spans a marketing site and an app, or a web frontend and an admin panel:

```yaml
applications_config: |
  {
    "applications": {
      "short-id-1": {
        "environment": {
          "url": "https://preview-${{ github.event.number }}-hackoffice.vercel.app",
          "name": "PR-${{ github.event.number }}"
        }
      },
      "short-id-2": {
        "environment": {
          "url": "https://preview-${{ github.event.number }}-saas.vercel.app",
          "name": "PR-${{ github.event.number }}"
        }
      }
    }
  }
```

If your preview URL isn't known up front, resolve it in an earlier step and feed the output in — for example after waiting on your deploy provider's status check.

### Block the merge on the verdict

With `blocking: true` the step waits for the review to finish and fails the workflow if it comes back `FAILED` or `CANCELLED`. Combine that with a required status check and bad changes stop at the PR instead of at staging.

Under the hood the action polls `GET /v1/chat/{chat_short_id}` every 20 seconds until the assistant's message reaches `COMPLETED`, `FAILED`, or `CANCELLED`, giving up after 60 minutes with a `TIMED_OUT` status. While the review is still pending, it retries up to twice on transient timeouts.

With `blocking: false` the action fires the review and returns immediately — handy if you'd rather read the verdict in the QA.tech dashboard or in your GitHub integration.

### Steer the review

Use `context` to tell the agents what matters in this change: which flows to prioritise, which acceptance criteria to check, which areas to leave alone.

```yaml
- uses: QAdottech/run-action/change-review@v2
  with:
    project_short_id: 'your-project-short-id'
    api_token: ${{ secrets.QATECH_API_TOKEN }}
    applications_config: ${{ steps.preview.outputs.config }}
    context: |
      This PR reworks checkout. Focus on the discount-code path and
      the guest checkout flow. Ignore the legacy /v1/cart pages.
    blocking: true
```

### Post the verdict back on the PR

`chat_response` holds the assistant's written review, so you can drop it straight into a comment:

```yaml
permissions:
  pull-requests: write

steps:
  - uses: QAdottech/run-action/change-review@v2
    id: review
    continue-on-error: true
    with:
      project_short_id: 'your-project-short-id'
      api_token: ${{ secrets.QATECH_API_TOKEN }}
      applications_config: ${{ steps.preview.outputs.config }}
      blocking: true

  - uses: actions/github-script@v7
    if: steps.review.outputs.chat_response
    env:
      REVIEW_BODY: ${{ steps.review.outputs.chat_response }}
      REVIEW_URL: ${{ steps.review.outputs.chat_url }}
    with:
      script: |
        await github.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.issue.number,
          body: `## QA.tech Change Review\n\n${process.env.REVIEW_BODY}\n\n[View the full run](${process.env.REVIEW_URL})`,
        })

  - if: steps.review.outcome == 'failure'
    run: exit 1
```

`continue-on-error` lets the comment land even when the review comes back failing; the final step re-applies the failure so the check still goes red.

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `project_short_id` | Your QA.tech project short ID. | Yes | - |
| `api_token` | QA.tech API token. | Yes | - |
| `applications_config` | JSON of `{ "applications": { appId: { "environment": {...} } } }`. Every entry must include an `environment` (one of `url` / `shortId` / `applicationBuildShortId`). | Yes | - |
| `blocking` | Wait for the review to finish and fail the step on a bad verdict. | No | `false` |
| `context` | Free-form context appended to the review. | No | - |
| `pr_url` | Pull request URL to review. Defaults to the PR URL of the current `pull_request` event. | No | - |
| `api_url` | Custom API URL if needed. | No | `https://api.qa.tech` |

### Outputs

| Output | Description |
|--------|-------------|
| `chat_created` | Whether the change review was created. |
| `chat_short_id` | Short ID of the change review conversation. |
| `chat_url` | Dashboard URL of the review. |
| `chat_status` | Final status of the review (`COMPLETED`, `FAILED`, `CANCELLED`, or `TIMED_OUT`). Only set when `blocking` is true. |
| `chat_response` | The agent's written review. Only set when `blocking` is true. |

### Prefer zero config?

If you don't need the review wired into your own workflow, the [QA.tech GitHub App](https://qa.tech/product/integrations/github) picks up every PR and its preview deployment for you, and you can mention `@qa.tech` in a PR comment to trigger a deeper review. Use this action when you want control over when the review runs, which environment it targets, or how the verdict gates your pipeline. More on the product in [Dynamic PR Testing](https://qa.tech/product/pr-testing).

---

## Test plan runs

The root action triggers a QA.tech test plan — the same agents, running a suite you've defined rather than reviewing a diff. Good for post-merge checks on `main`, nightly regression, or release gates.

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
      - uses: QAdottech/run-action@v2
        with:
          project_short_id: 'your-project-short-id'
          api_token: ${{ secrets.QATECH_API_TOKEN }}
          test_plan_short_id: 'jgbinp'
```

To run several test plans, use the action multiple times in the same workflow.

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `project_short_id` | Your QA.tech project short ID. | Yes | - |
| `api_token` | QA.tech API token. | Yes | - |
| `test_plan_short_id` | Test plan short ID to run. Omit to run the project default. | No | - |
| `blocking` | Wait for the run to complete and fail the step if it fails. | No | `false` |
| `applications_config` | JSON string containing application environment overrides. | No | - |
| `api_url` | Custom API URL if needed. | No | `https://api.qa.tech` |

### Outputs

| Output | Description |
|--------|-------------|
| `run_created` | Whether the test run was created successfully. |
| `run_short_id` | The short ID of the run. |
| `run_url` | The URL of the run. |
| `run_status` | Final status of the run (`INITIATED`, `RUNNING`, `COMPLETED`, `ERROR`, `CANCELLED`, or `TIMED_OUT`). Only set when `blocking` is true. |
| `run_result` | The test execution result (`PASSED`, `FAILED`, or `SKIPPED`). Only set when `blocking` is true. |

### Blocking

With `blocking: true` the action creates the run, polls until it completes, sets `run_status` and `run_result`, and fails the step if the run fails.

```yaml
- uses: QAdottech/run-action@v2
  with:
    project_short_id: 'your-project-short-id'
    api_token: ${{ secrets.QATECH_API_TOKEN }}
    blocking: true
```

### Application environment overrides

Override which environment a test plan runs against — a preview deployment, a specific URL, or an environment already configured in QA.tech.

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
              "url": "https://preview-123-hackoffice.vercel.app",
              "name": "PR-123"
            }
          }
        }
      }
```

> **Note**: Check app.qa.tech under Test Plans → API Integration to see which applications are connected to your test plan.

---

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
