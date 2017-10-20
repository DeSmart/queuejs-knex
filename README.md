# @desmart/queue-knex

Knexjs connector for [@desmart/queue](https://github.com/DeSmart/queuejs/)

# installation

```bash
npm i @desmart/queue-knex
```

# example

```js
const { manager, job } = require('@desmart/queue')
const connector = require('@desmart/queue-knex')

const queue = manager(connector({
  knex: knexConnectionInstance
}))
```

# configuration

Connector can be configured by passing options object to factory function.

Available options:

* `knex` knex connection to db
* `table [jobs]` which table should be used to store/retrieve jobs
* `retryAfter [600]` number of seconds for which job will be locked

# database migration

In `migrations/` folder you will find Knex migration file. Import/copy it to you application.

# development

If you're planning to contribute to the package please make sure to adhere to following conventions.

## tests & linting

1. lint your code using [standard](https://standardjs.com/); run `npm run lint` to check if there are any linting errors
2. make sure to write tests for all the changes/bug fixes

## testing against selected databases

Default test suite is using SQLite db.

It's possible to run tests against different databases.  
This requires installed Docker Native.

To run tests for latest MySQL:

```bash
NODE_ENV=mysql .travis/setUp.sh
NODE_ENV=mysql npm test
NODE_ENV=mysql .travis/tearDown.sh
```

Available databases:

* `mysql` latest version of MySQL
* `mysql5` last available version of MySQL 5
* `postgres` latest version of Postgres
* `postgres9` last available version of Postgres 9

## general practices

We're not looking back! You are encouraged to use all features from ES6.  
This package follows functional approach - if possible use pure functions, avoid classes etc.

## issues & PR

1. try to provide regression test when you find a bug
2. share some context on what you are trying to do, with enough code to reproduce the issue

