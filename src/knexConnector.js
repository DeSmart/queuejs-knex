module.exports = ({
  knex,
  table = 'jobs',
  retryAfter = 60
}) => ({
  onJob (job) {
  },

  push (job) {
  },

  listen (queue) {
  }
})
