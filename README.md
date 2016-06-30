# Safe Water API

API server that provides the [Dispenser Dashboards](https://github.com/evidenceaction/Dispensers-Dashboard) with data and content.

## Content
The copy of each section is stored in its own markdown file in the [app/content](https://github.com/evidenceaction/Dispensers-Dashboard-API/tree/master/app/content) folder. To edit the content, click on the file-name of the section and then on the edit button:

![image](https://cloud.githubusercontent.com/assets/751330/15194515/3f9d9520-1791-11e6-9e17-f9a1fee2248c.png)

Each file should have roughly the following structure:

```
---
title: Access
---
Number of people served by dispensers across the three countries of operation. 

We collect and verify data on the number of households using a waterpoint. The number of people per household is estimated based on monthly evaluations of randomly selected households.
```

The `title` property between the hyphens indicates the title. Anything else between the hyphens will be ignored by the site.

All the text after the second `---`, will be regarded as the body text and can be styled using Markdown. For more information about the Markdown format, please see [this cheatsheet](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet).

## Data
The API is powered by a SQLite database that is generated by a worker script (`worker/index.js`). It fetches the data from two locations:

1. the Access, Usage and Reliability sections are based on operational data from the Progmis database
2. the Carbon data is stored in a JSON file in `app/data/carbon-data.json`

The data is updated every time a commit is made to the master branch of this repository. Travis detects the change, will run the worker script and deploy a new version of the database to the server. x

### Updating the dashboards
To trigger a data update, you will have to make a dummy commit to the master branch of this repo. That can be a simple edit in the Readme. Once the edit is made, it may take a couple of minutes for Travis to deploy the changes.

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

