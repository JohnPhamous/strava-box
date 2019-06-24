<p align="center">
  <img width="400" src="https://i.imgur.com/aVJXxvE.png">
  <h3 align="center">strava-box</h3>
  <p align="center">Update a gist to contain your YTD Strava distances</p>
</p>

---

## Previous Work

This repo is based off of [matchai's waka-box](https://github.com/matchai/waka-box).

## Setup

### Prep work

1. Create a new public GitHub Gist (https://gist.github.com/)
1. Create a token with the `gist` scope and copy it. (https://github.com/settings/tokens/new)
1. Create a Strava Application (https://www.strava.com/settings/api)
1. Copy the `Access Token`
1. Get your `Athlete Token` by going to https://www.strava.com, click your profile photo in the top right corner. Copy the ID in the url. `https://www.strava.com/athletes/`**`12345`**

### Project setup

1. Fork this repo
1. Log into CircleCI with your GitHub (https://circleci.com/vcs-authorize/)
1. Click on "Add Projects" on the sidebar
1. Set up a project with the newly created fork
1. Go to Project Settings > Environment Variables
1. Add the following environment variables:

- **GIST_ID:** The ID portion from your gist url `https://gist.github.com/<github username>/`**`6d5f84419863089a167387da62dd7081`**.
- **GITHUB_TOKEN:** The GitHub token generated above.
- **STRAVA_ATHLETE_ID:** The ID you got from visiting your profile page.
- **STRAVA_ACCESS_TOKEN:** The access token you got from the Strava API page.
