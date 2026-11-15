const assert = require("assert");
const { buildLines } = require("./index");

const lines = buildLines([
  { sport_type: "Run", distance: 10000, moving_time: 3600 },
  { sport_type: "TrailRun", distance: 5000, moving_time: 3600 },
  { sport_type: "WeightTraining", distance: 0, moving_time: 7200 },
  { sport_type: "Workout", distance: 0, moving_time: 3600 },
  { type: "Walk", distance: 4000, moving_time: 3600 },
  { sport_type: "Yoga", distance: 0, moving_time: 1800 },
  { sport_type: "Swim", distance: 1000, moving_time: 1200 },
  { sport_type: "Ride", distance: 9000, moving_time: 600 }
]);

assert.deepStrictEqual(lines.map(l => l.split(" ")[0]), [
  "Gym",
  "Run",
  "Walk",
  "Yoga",
  "Swim"
]);
assert(/^Gym +2x .+ 3h$/.test(lines[0]), lines[0]);
assert(/^Run +15\.00 km .+ 2h$/.test(lines[1]), lines[1]);
assert(lines.every(l => l.length === lines[0].length));
assert.deepStrictEqual(buildLines([]), []);
console.log(lines.join("\n"));
