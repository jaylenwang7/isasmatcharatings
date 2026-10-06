// Rebuilds the site whenever a form response lands in the sheet, instead of waiting for the nightly run.
// This lives in the response Google Sheet's Apps Script project, not in GitHub; see the README for setup.

const REPO = 'jaylenwang7/isasmatcharatings';
const WORKFLOW = 'update-data.yml';

function triggerDeploy() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  // Throws on a non-2xx response (e.g. an expired token), which makes Apps Script email a failure notice
  UrlFetchApp.fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
    payload: JSON.stringify({ ref: 'main' }),
  });
}

// Run once by hand to register triggerDeploy on form submit
function installTrigger() {
  // Remove any earlier copy so running this twice doesn't deploy twice per submission
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'triggerDeploy')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('triggerDeploy').forSpreadsheet(SpreadsheetApp.getActive()).onFormSubmit().create();
}
