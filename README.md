# Safe Water API

API server that back the [Safe Waters dashboards](https://github.com/developmentseed/safe-water/).
Set of public dashboards for dispensers for safe water project to provide insight into its KPI's.
The structure and build of our dashboards are aimed at different stakeholders of the project, including a donor base that is part of the effective altruism movement and seeks to understand the data behind the program.

### Requirements
These dependencies are needed to build the app.

- Node (v4.2.x) & Npm ([nvm](https://github.com/creationix/nvm) usage is advised)

> The versions mentioned are the ones used during development. It could work with newer ones.
  Run `nvm use` to activate the correct version.

### Setup
Install dependencies:
```
$ npm install
```

### Running the App
```
npm run start-dev
```
This will start the app at `http://localhost:3000`.
This command starts the server with `nodemon` which watches files and restarts when there's a change. 

