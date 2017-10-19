const connection = {
  user: 'test',
  database: 'test',
  password: 'test',
  port: 7000,
  pool: { min: 0, max: 1 }
}

const drivers = {
  mysql5: 'mysql2',
  mysql: 'mysql2',
  postgres: 'pg',
  postgres9: 'pg'
}

const development = {
  client: 'sqlite3',
  connection: {
    filename: './dev.sqlite3'
  }
}

module.exports = Object.keys(drivers)
  .reduce(
    (config, envName) => Object.assign({}, config, {
      [envName]: {
        client: drivers[envName],
        connection
      }
    }),
    { development }
  )
