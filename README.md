<p align="center">
  <img width="400" src="https://i.imgur.com/v8XouyY.png">
  <h3 align="center">strava-box</h3>
  <p align="center">Update a gist to contain your YTD Strava totals per sport</p>
</p>

---

## Previous Work

This repo is based off of [matchai's waka-box](https://github.com/matchai/waka-box).

## Setup

### Prep work

1. Create a new public GitHub Gist (https://gist.github.com/)
1. Create a token with the `gist` scope and copy it. (https://github.com/settings/tokens/new)
1. Create a Strava Application (https://www.strava.com/settings/api)
   - Copy the `Client ID` and `Client Secret`
1. Get a `Refresh Token` that can read your activities (the one on the Strava API page cannot):
   - Open `https://www.strava.com/oauth/authorize?client_id=<Client ID>&response_type=code&redirect_uri=http://localhost&approval_prompt=force&scope=activity:read` (use `activity:read_all` to count private activities) and click Authorize
   - Copy the `code` from the url you are sent to
   - Run `curl -X POST https://www.strava.com/oauth/token -d client_id=<Client ID> -d client_secret=<Client Secret> -d code=<code> -d grant_type=authorization_code` and copy the `refresh_token`

### Project setup

1. Fork this repo
1. Log into CircleCI with your GitHub (https://circleci.com/vcs-authorize/)
1. Click on "Add Projects" on the sidebar
1. Set up a project with the newly created fork
1. Go to Project Settings > Environment Variables
1. Add the following environment variables:

- **GIST_ID:** The ID portion from your gist url `https://gist.github.com/<github username>/`**`6d5f84419863089a167387da62dd7081`**.
- **GITHUB_TOKEN:** The GitHub token generated above.
- **STRAVA_CLIENT_ID:** The client ID you got from the Strava API page.
- **STRAVA_CLIENT_SECRET:** The client secret you got from the Strava API page.
- **STRAVA_REFRESH_TOKEN:** The refresh token you got from the `curl` command above.
- (optional) **UNITS:** `miles` or `metres` or `meters` (default)
