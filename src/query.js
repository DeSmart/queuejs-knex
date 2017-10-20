const Maybe = require('folktale/maybe')
const { timestamp } = require('./utils')

const isAvailable = function () {
  this.whereNull('reserved_at')
    .where('available_at', '<=', timestamp())
}

const isReservedButExpired = retryAfter => function () {
  this.where('reserved_at', '<=', timestamp() - retryAfter)
}

const getAvailableJob = (trx, table, reservationTtl) =>
  trx.table(table)
    .forUpdate()
    .where(isAvailable)
    .orWhere(isReservedButExpired(reservationTtl))
    .orderBy('id', 'asc')
    .first()
    .then(Maybe.fromNullable)

const reserveJob = (trx, table, record) =>
  trx.table(table)
    .where({ id: record.id })
    .update({
      reserved_at: timestamp(),
      attempts: record.attempts + 1
    })

const removeJob = (knex, table, id) =>
  knex.transaction(
    trx => trx.from(table)
      .where({ id })
      .delete()
  )

const releaseJob = (knex, table, id, delay) =>
  knex.transaction(
    trx => trx.from(table)
      .where({ id })
      .update({
        reserved_at: null,
        available_at: timestamp() + delay
      })
  )

const insertJob = (knex, table, data) =>
  knex.table(table)
    .returning('id')
    .insert(data)
    .then(([id]) => id)

module.exports = { getAvailableJob, reserveJob, removeJob, releaseJob, insertJob }
