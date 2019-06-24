require("dotenv").config();
const Octokit = require("@octokit/rest");
const fetch = require("node-fetch");

const {
  GIST_ID: gistId,
  GITHUB_TOKEN: githubToken,
  STRAVA_ATHLETE_ID: stravaAtheleteId,
  STRAVA_ACCESS_TOKEN: stravaAccessToken,
  UNITS: units
} = process.env;

const octokit = new Octokit({
  auth: `token ${githubToken}`
});

async function main() {
  const stats = await getStravaStats();
  await updateGist(stats);
}

/**
 * Fetches your data from the Strava API
 * The distance returned by the API is in meters
 */
async function getStravaStats() {
  const API_BASE = "https://www.strava.com/api/v3/athletes/";
  const API = `${API_BASE}${stravaAtheleteId}/stats?access_token=${stravaAccessToken}`;

  const data = await fetch(API);
  const json = await data.json();

  return json;
}

async function updateGist(data) {
  let gist;
  try {
    gist = await octokit.gists.get({ gist_id: gistId });
  } catch (error) {
    console.error(`Unable to get gist\n${error}`);
  }

  // Used to index the API response
  const keyMappings = {
    Running: {
      key: "ytd_run_totals"
    },
    Swimming: {
      key: "ytd_swim_totals"
    },
    Biking: {
      key: "ytd_ride_totals"
    }
  };

  let totalDistance = 0;

  // Store the activity name and distance
  let activities = Object.keys(keyMappings).map(activityType => {
    const { key } = keyMappings[activityType];
    const { distance } = data[key];

    totalDistance += distance;

    return {
      name: activityType,
      distance
    };
  });

  // Calculate the percentages and bar charts for the 3 activities
  activities = activities.map(activity => {
    const percent = (activity["distance"] / totalDistance) * 100;
    return {
      ...activity,
      percent: percent.toFixed(1),
      barChart: generateBarChart(percent, 35)
    };
  });

  // Append and/or convert the distance units
  activities = activities.map(activity => {
    return {
      ...activity,
      distance: formatDistance(activity["distance"])
    };
  });

  // Format the data to be displayed in the Gist
  const lines = activities.map(activity => {
    const { name, distance, percent, barChart } = activity;
    return `${name.padEnd(10)} ${distance.padEnd(
      10
    )} ${barChart} ${percent.padStart(5)}%`;
  });

  try {
    // Get original filename to update that same file
    const filename = Object.keys(gist.data.files)[0];
    await octokit.gists.update({
      gist_id: gistId,
      files: {
        [filename]: {
          filename: `YTD Strava Metrics`,
          content: lines.join("\n")
        }
      }
    });
  } catch (error) {
    console.error(`Unable to update gist\n${error}`);
  }
}

function generateBarChart(percent, size) {
  const empty = "░";
  const full = "█";
  const barsFull = Math.round(size * (percent / 100));
  return full.repeat(barsFull).padEnd(size, empty);
}

function formatDistance(distance) {
  const trimmedDistance = parseFloat(distance).toFixed(2);
  switch (units) {
    case "meters":
      return `${trimmedDistance} m`;
    case "miles":
      return `${metersToMiles(distance)} mi`;
    default:
      return `${trimmedDistance} m`;
  }
}

function metersToMiles(meters) {
  const CONVERSION_CONSTANT = 0.000621371192;
  return (meters * CONVERSION_CONSTANT).toFixed(2);
}

(async () => {
  await main();
})();
