const { job } = require('@desmart/queue')

const toJob = (knex, table) => record => job.fromJSON(JSON.parse(record.payload))
  .increment()
  .withActions({
    remove: () => knex.transaction(
      trx => trx.from(table).where({ id: record.id }).delete()
    )
  })

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
      created_at: new Date()
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
          .orderBy('id', 'asc')
          .first()

        if (!record) {
          throw new Error()
        }

        await knex.table(table)
          .transacting(trx)
          .where({ id: record.id })
          .update({
            reserved_at: new Date(),
            attempts: record.attempts + 1
          })

        return record
      })
      .then(toJob(knex, table))
      .catch(_ => null)
  }
})
