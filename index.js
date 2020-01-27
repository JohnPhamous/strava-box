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
    throw error;
  }

  // Used to index the API response
  const keyMappings = {
    Running: {
      key: "ytd_run_totals"
    },
    Swimming: {
      key: "ytd_swim_totals"
    },
    Cycling: {
      key: "ytd_ride_totals"
    }
  };

  let totalDistance = 0;

  let lines = Object.keys(keyMappings).map(activityType => {
    // Store the activity name and distance
    const { key } = keyMappings[activityType];
    try {
      const { distance, moving_time } = data[key];
      totalDistance += distance;
      return {
        name: activityType,
        pace: distance * 3600 / (moving_time ? moving_time : 1),
        distance
      };
    } catch (error) {
      console.error(`Unable to get distance\n${error}`);
      return {
        name: activityType,
        pace: 0,
        distance: 0
      };
    }
  }).map(activity => {
    // Calculate the percentages and bar charts for the 3 activities
    const percent = (activity["distance"] / totalDistance) * 100;
    const pacePH = formatDistance(activity["pace"]);
    const pace = pacePH.substring(0, pacePH.length - 3);  // strip unit
    return {
      ...activity,
      distance: formatDistance(activity["distance"]),
      pace: `${pace}/h`,
      barChart: generateBarChart(percent, 19)
    };
  }).map(activity => {
    // Format the data to be displayed in the Gist
    const { name, distance, pace, barChart } = activity;
    return `${name.padEnd(10)} ${distance.padStart(
      13
    )} ${barChart} ${pace.padStart(7)}`;
  });

  // Last 4 weeks
  let monthDistance = 0;
  let monthTime = 0;
  let monthAchievements = 0;
  for (let [key, value] of Object.entries(data)){
    if (key.startsWith("recent_") && key.endsWith("_totals")){
      monthDistance += value["distance"];
      monthTime += value["moving_time"];
      monthAchievements += value["achievement_count"];
    }
  }
  lines.push(
    `Last month ${
      formatDistance(monthDistance).padStart(13)
    } ${
      (
        monthAchievements
        ? `${monthAchievements} achievement${monthAchievements > 1 ? "s" : ""}`
        : ""
      ).padStart(19)
    } ${
      `${(monthTime / 3600).toFixed(0)}`.padStart(3)
    }:${
      (monthTime / 60).toFixed(0) % 60
    }h`
  );

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
    throw error;
  }
}

function generateBarChart(percent, size) {
  const syms = "░▏▎▍▌▋▊▉█";

  const frac = Math.floor((size * 8 * percent) / 100);
  const barsFull = Math.floor(frac / 8);
  if (barsFull >= size) {
    return syms.substring(8, 9).repeat(size);
  }
  const semi = frac % 8;

  return [
    syms.substring(8, 9).repeat(barsFull),
    syms.substring(semi, semi + 1),
  ].join("").padEnd(size, syms.substring(0, 1));
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
