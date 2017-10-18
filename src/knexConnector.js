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
      created_at: Date.now()
    }

    return knex.table(table)
      .returning('id')
      .insert(data)
      .then(([id]) => id)
  },

  listen (queue) {
  }
})
