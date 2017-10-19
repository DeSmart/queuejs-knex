const dbConnection = {
  user: 'test',
  database: 'test',
  password: 'test'
}

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: './dev.sqlite3'
    }
  },

  mysql5: {
    client: 'mysql2',
    connection: dbConnection
  },

  mysql: {
    client: 'mysql2',
    connection: dbConnection
  },

  postgres: {
    client: 'pg',
    connection: dbConnection
  },

  postgres9: {
    client: 'pg',
    connection: dbConnection
  }
}
