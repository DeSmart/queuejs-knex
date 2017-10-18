
exports.up = function (knex, Promise) {
  return knex.schema.createTable('jobs', table => {
    table.bigIncrements('id')
    table.string('queue')
    table.text('payload', 'longtext')
    table.integer('attempts').unsigned()
    table.integer('reserved_at').unsigned().nullable()
    table.integer('available_at').unsigned()
    table.integer('created_at').unsigned()
    table.index(['queue', 'reserved_at'])
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTable('jobs')
}
