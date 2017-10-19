const { job } = require('@desmart/queue')

const dateToTimestamp = date => Math.floor(date.getTime() / 1000, 0)
const timestamp = date => date
  ? dateToTimestamp(date)
  : dateToTimestamp(new Date())

const toJob = (knex, table) => record => job.fromJSON(JSON.parse(record.payload))
  .increment()
  .withActions({
    remove () {
      return knex.transaction(
        trx => trx.from(table)
          .where({ id: record.id })
          .delete()
      )
    },

    release (delay = 0) {
      return knex.transaction(
        trx => trx.from(table)
          .where({ id: record.id })
          .update({
            reserved_at: null,
            available_at: timestamp() + delay
          })
      )
    }
  })

const isAvailable = function () {
  this.whereNull('reserved_at')
    .where('available_at', '<=', timestamp())
}

const isReservedButExpired = retryAfter => function () {
  this.where('reserved_at', '<=', timestamp() - retryAfter)
}

module.exports = ({
  knex,
  table = 'jobs',
  retryAfter = 60
}) => ({
  onJob (job) {
  },

  push (job) {
    const data = {
      queue: job.queue,
      payload: JSON.stringify(job),
      attempts: job.attempts,
      created_at: timestamp(),
      available_at: timestamp()
    }

    return knex.table(table)
      .returning('id')
      .insert(data)
      .then(([id]) => id)
  },

  listen (queue) {
  },

  async pop (queue) {
    return knex
      .transaction(async trx => {
        const record = await knex.table(table)
          .transacting(trx)
          .forUpdate()
          .where(isAvailable)
          .orWhere(isReservedButExpired(retryAfter))
          .orderBy('id', 'asc')
          .first()

        if (!record) {
          throw new Error()
        }

        await knex.table(table)
          .transacting(trx)
          .where({ id: record.id })
          .update({
            reserved_at: timestamp(),
            attempts: record.attempts + 1
          })

        return record
      })
      .then(toJob(knex, table))
      .catch(_ => null)
  }
})
