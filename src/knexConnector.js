const { job } = require('@desmart/queue')

const dateToTimestamp = date => Math.floor(date.getTime() / 1000, 0)
const timestamp = date => date
  ? dateToTimestamp(date)
  : dateToTimestamp(new Date())

const getJobAttributes = dbRecord => Object.assign(
  JSON.parse(dbRecord.payload),
  { attempts: dbRecord.attempts }
)

const toJob = (knex, table) => record => job.fromJSON(getJobAttributes(record))
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
  retryAfter = 600,
  dispatchJob = () => { }
}) => ({

  onJob (handler) {
    dispatchJob = handler
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

  /**
   * Listen for incoming jobs
   *
   * @param  {String}   queue        name of queue
   * @param  {Object}   options
   * @param  {Integer}  options.wait wait given number of seconds between checking for new jobs
   * @return {Function} calling this function will break loop cycle
   */
  listen (queue, { wait = 10 } = {}) {
    const fetch = async () => {
      const job = await this.pop(queue)
      job && dispatchJob(job)
    }

    const timer = setInterval(fetch, wait * 1000)

    return () => {
      clearInterval(timer)
    }
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
