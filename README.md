# isasmatcharatings

Isa's matcha tier list, live at https://jaylenwang.com/isasmatcharatings/.

## How it updates

1. Isa submits a review through the Google Form, which adds a row to the response Google Sheet.
2. The `Update Data and Deploy` workflow runs `scripts/fetch_data.py`, which reads the sheet, geocodes each address, and downloads and resizes each photo from Drive.
3. The workflow builds the React app and deploys it to GitHub Pages.

The workflow runs on every push to `main`, nightly at midnight UTC, and on every form submission once the Apps Script trigger below is set up.
It can also be run by hand from the Actions tab.

Reviews that can't be published (for example, an address that can't be geocoded and no lat/long) are listed in the workflow run's summary.

## Deploy and check

`scripts/check-deploy.sh` watches the deploy and then confirms the live site is serving reviews, listing any reviews the run skipped:

```sh
scripts/check-deploy.sh            # watch the run for the current commit
scripts/check-deploy.sh --push     # push the current branch first, then watch
scripts/check-deploy.sh --refresh  # rebuild from the sheet now, without a commit
```

It also stops early if GitHub has disabled the workflow, and prints the command to re-enable it.

The repository must stay public: GitHub Pages only serves private repositories on paid plans.
GitHub also turns off the nightly run after 60 days without a commit, which is why form submissions trigger deploys directly.

## Deploy on form submission

`scripts/trigger-deploy.gs` starts the workflow whenever a form response arrives, so the site updates within a few minutes.
To set it up:

1. Create a fine-grained GitHub token at https://github.com/settings/personal-access-tokens with access to only this repository and the **Actions: Read and write** permission.
2. In the response Google Sheet, open **Extensions > Apps Script** and paste in `scripts/trigger-deploy.gs`.
3. In the Apps Script editor, open **Project Settings > Script Properties** and add a property named `GITHUB_TOKEN` with the token as its value.
4. Select `installTrigger` in the toolbar, click **Run**, and approve the permissions prompt.

If the token expires, Apps Script emails a failure notice; create a new token and replace the `GITHUB_TOKEN` property.

## Secrets

The workflow needs two repository secrets:

- `GOOGLE_SHEETS_CREDENTIALS`: the JSON key of a Google service account that the sheet and the photo upload folder are shared with.
- `SHEET_ID`: the ID of the response sheet.

## Local development

```sh
npm ci
npm start
```

`public/data/places.json` is empty in the repository.
To see real reviews locally, copy it from https://jaylenwang.com/isasmatcharatings/data/places.json; photos won't load, since they're only generated in CI.
