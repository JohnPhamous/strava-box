require("dotenv").config();
const Octokit = require("@octokit/rest");
const fetch = require("node-fetch");
const fs = require("fs");

const {
  GIST_ID: gistId,
  GITHUB_TOKEN: githubToken,
  STRAVA_ATHLETE_ID: stravaAtheleteId,
  STRAVA_ACCESS_TOKEN: stravaAccessToken,
  STRAVA_REFRESH_TOKEN: stravaRefreshToken,
  STRAVA_CLIENT_ID: stravaClientId,
  STRAVA_CLIENT_SECRET: stravaClientSecret,
  UNITS: units
} = process.env;
const API_BASE = "https://www.strava.com/api/v3/athletes/";
const AUTH_CACHE_FILE = "strava-auth.json";

const octokit = new Octokit({
  auth: `token ${githubToken}`
});

async function main() {
  const stats = await getStravaStats();
  await updateGist(stats);
}

/**
 * Updates cached strava authentication tokens if necessary
 */
async function getStravaToken(){
  // default env vars
  let cache = {
    // stravaAccessToken: stravaAccessToken,
    stravaRefreshToken: stravaRefreshToken
  };
  // read cache from disk
  try {
    const jsonStr = fs.readFileSync(AUTH_CACHE_FILE);
    const c = JSON.parse(jsonStr);
    Object.keys(c).forEach(key => {
      cache[key] = c[key];
    });
  } catch (error) {
    console.log(error);
  }
  console.debug(`ref: ${cache.stravaRefreshToken.substring(0,6)}`);

  // get new tokens
  const data = await fetch("https://www.strava.com/oauth/token", {
    method: 'post',
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: stravaClientId,
      client_secret: stravaClientSecret,
      refresh_token: cache.stravaRefreshToken
    }),
    headers: {'Content-Type': 'application/json'},
  }).then(
    data => data.json()
  );
  cache.stravaAccessToken = data.access_token;
  cache.stravaRefreshToken = data.refresh_token;
  console.debug(`acc: ${cache.stravaAccessToken.substring(0,6)}`);
  console.debug(`ref: ${cache.stravaRefreshToken.substring(0,6)}`);

  // save to disk
  fs.writeFileSync(AUTH_CACHE_FILE, JSON.stringify(cache));

  return cache.stravaAccessToken;
}

/**
 * Fetches your data from the Strava API
 * The distance returned by the API is in meters
 */
async function getStravaStats() {
  const API = `${API_BASE}${stravaAtheleteId}/stats?access_token=${await getStravaToken()}`;

  const json = await fetch(API).then(data => data.json());
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
    try {
      const { distance } = data[key];

      totalDistance += distance;
      return {
        name: activityType,
        distance
      };
    } catch (error) {
      console.error(`Unable to get distance\n${error}`);
      const distance = 0;
      return {
        name: activityType,
        distance
      };
    }
  });

  // Calculate the percentages and bar charts for the 3 activities
  activities = activities.map(activity => {
    const percent = (activity["distance"] / totalDistance) * 100;
    return {
      ...activity,
      percent: percent.toFixed(1),
      barChart: generateBarChart(percent, 28)
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
      13
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
    const syms = "░▏▎▍▌▋▊▉█";

    const frac = size * 8 * percent / 100;
    const barsFull = Math.floor(frac / 8);
    const semi = frac % 8;
    const barsEmpty = size - barsFull - 1;

    return [
        syms.substring(8,9).repeat(barsFull),
        syms.substring(semi,semi+1),
        syms.substring(0,1).repeat(barsEmpty),
    ].join('');
}

function formatDistance(distance) {
  switch (units) {
    case "meters":
      return `${metersToKm(distance)} km`;
    case "miles":
      return `${metersToMiles(distance)} mi`;
    default:
      return `${metersToKm(distance)} km`;
  }
}

function metersToMiles(meters) {
  const CONVERSION_CONSTANT = 0.000621371192;
  return (meters * CONVERSION_CONSTANT).toFixed(2);
}

function metersToKm(meters) {
  const CONVERSION_CONSTANT = 0.001;
  return (meters * CONVERSION_CONSTANT).toFixed(2);
}

(async () => {
  await main();
})();
