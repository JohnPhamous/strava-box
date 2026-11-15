require("dotenv").config();
const Octokit = require("@octokit/rest");
const fetch = require("node-fetch");
const fs = require("fs");

const {
  GIST_ID: gistId,
  GITHUB_TOKEN: githubToken,
  STRAVA_REFRESH_TOKEN: stravaRefreshToken,
  STRAVA_CLIENT_ID: stravaClientId,
  STRAVA_CLIENT_SECRET: stravaClientSecret,
  UNITS: units
} = process.env;
const API = "https://www.strava.com/api/v3/athlete/activities";
const AUTH_CACHE_FILE = "strava-auth.json";

const octokit = new Octokit({
  auth: `token ${githubToken}`
});

async function main() {
  const activities = await getStravaActivities();
  await updateGist(buildLines(activities));
}

/**
 * Updates cached strava authentication tokens if necessary
 */
async function getStravaToken() {
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
  console.debug(`ref: ${cache.stravaRefreshToken.substring(0, 6)}`);

  // get new tokens
  const data = await fetch("https://www.strava.com/oauth/token", {
    method: "post",
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: stravaClientId,
      client_secret: stravaClientSecret,
      refresh_token: cache.stravaRefreshToken
    }),
    headers: { "Content-Type": "application/json" }
  }).then(data => data.json());
  cache.stravaAccessToken = data.access_token;
  cache.stravaRefreshToken = data.refresh_token;
  console.debug(`acc: ${cache.stravaAccessToken.substring(0, 6)}`);
  console.debug(`ref: ${cache.stravaRefreshToken.substring(0, 6)}`);

  // save to disk
  fs.writeFileSync(AUTH_CACHE_FILE, JSON.stringify(cache));

  return cache.stravaAccessToken;
}

/**
 * Fetches this year's activities from the Strava API
 * Needs a refresh token with the `activity:read` scope
 */
async function getStravaActivities() {
  const token = await getStravaToken();
  const after = new Date(new Date().getFullYear(), 0, 1) / 1000;
  const activities = [];
  for (let page = 1; ; page++) {
    const json = await fetch(
      `${API}?after=${after}&per_page=200&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(data => data.json());
    if (!Array.isArray(json)) {
      throw new Error(`Unable to get activities\n${JSON.stringify(json)}`);
    }
    activities.push(...json);
    if (json.length < 200) return activities;
  }
}

// Strava sport types grouped under one line; anything else keeps its own name
const SPORTS = {
  Run: ["Run", "TrailRun", "VirtualRun"],
  Ride: [
    "Ride",
    "VirtualRide",
    "MountainBikeRide",
    "GravelRide",
    "EBikeRide",
    "EMountainBikeRide"
  ],
  Swim: ["Swim"],
  Walk: ["Walk", "Hike"],
  Gym: [
    "WeightTraining",
    "Workout",
    "Crossfit",
    "HighIntensityIntervalTraining"
  ]
};
const MAX_LINES = 5; // a pinned gist shows 5 lines

/**
 * One line per sport, biggest moving time first.
 * The bar is the sport's share of the total moving time.
 */
function buildLines(activities) {
  const totals = {};
  let totalTime = 0;
  activities.forEach(activity => {
    const type = activity.sport_type || activity.type;
    const name =
      Object.keys(SPORTS).find(s => SPORTS[s].includes(type)) || type;
    const t =
      totals[name] || (totals[name] = { distance: 0, time: 0, count: 0 });
    t.distance += activity.distance || 0;
    t.time += activity.moving_time || 0;
    t.count += 1;
    totalTime += activity.moving_time || 0;
  });

  return Object.keys(totals)
    .sort((a, b) => totals[b].time - totals[a].time)
    .slice(0, MAX_LINES)
    .map(name => {
      const { distance, time, count } = totals[name];
      // Sports without distance (gym) show the number of sessions instead
      const amount = distance ? formatDistance(distance) : `${count}x`;
      const percent = totalTime ? (time / totalTime) * 100 : 0;
      return `${name.substring(0, 10).padEnd(10)} ${amount.padStart(
        13
      )} ${generateBarChart(percent, 19)} ${`${Math.round(
        time / 3600
      )}h`.padStart(7)}`;
    });
}

async function updateGist(lines) {
  let gist;
  try {
    gist = await octokit.gists.get({ gist_id: gistId });
  } catch (error) {
    console.error(`Unable to get gist\n${error}`);
    throw error;
  }

  try {
    // Get original filename to update that same file
    const filename = Object.keys(gist.data.files)[0];
    await octokit.gists.update({
      gist_id: gistId,
      files: {
        [filename]: {
          filename: `YTD Strava Metrics`,
          content: lines.join("\n") || "No activities yet this year"
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

  return [syms.substring(8, 9).repeat(barsFull), syms.substring(semi, semi + 1)]
    .join("")
    .padEnd(size, syms.substring(0, 1));
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

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { buildLines };
