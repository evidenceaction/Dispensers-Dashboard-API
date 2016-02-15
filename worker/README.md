Fetches data from the Dispenser for Safe Water database, processes it and stores it in SQLite format.

```
node index.js
```

Note that running this will delete the previously creates SQLite file. If you want to keep it, move the file before running this script.

## Config
Add the connection information of the MySQL db to the config file:

```
module.exports = {
  sourceDb: {
    host      : 12.34.56.78,
    user      : USER,
    password  : PASS,
    database  : DB
  }
};
```
