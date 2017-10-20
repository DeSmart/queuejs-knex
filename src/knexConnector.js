const Maybe = require('folktale/maybe')
const { job } = require('@desmart/queue')
const { timestamp } = require('./utils')
const query = require('./query')

const getJobAttributes = dbRecord => Object.assign(
  JSON.parse(dbRecord.payload),
  { attempts: dbRecord.attempts }
)

const toJob = (knex, table) => dbRecord =>
  dbRecord.map(getJobAttributes)
    .map(job.fromJSON)
    .map(job => job.increment())
    .map(job => job.withActions({
      remove () {
        const { id } = dbRecord.getOrElse({ id: null })
        return query.removeJob(knex, table, id)
      },

      release (delay = 0) {
        const { id } = dbRecord.getOrElse({ id: null })
        return query.releaseJob(knex, table, id, delay)
      }
    }))

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
    return query.insertJob(knex, table, {
      queue: job.queue,
      payload: JSON.stringify(job),
      attempts: job.attempts,
      created_at: timestamp(),
      available_at: timestamp()
    })
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

      job.matchWith({
        Just: ({ value }) => dispatchJob(value),
        Nothing: () => {}
      })
    }

    const timer = setInterval(fetch, wait * 1000)

    return () => {
      clearInterval(timer)
    }
  },

  async pop (queue) {
    return knex
      .transaction(async trx => {
        const record = await query.getAvailableJob(trx, table, retryAfter)

        return record.matchWith({
          Just: async ({ value }) => {
            await query.reserveJob(trx, table, value)
            return Maybe.Just(value)
          },
          Nothing: Maybe.Nothing
        })
      })
      .then(toJob(knex, table))
  }
})
