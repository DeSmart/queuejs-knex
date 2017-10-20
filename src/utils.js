const dateToTimestamp = date => Math.floor(date.getTime() / 1000, 0)

const timestamp = date => date
  ? dateToTimestamp(date)
  : dateToTimestamp(new Date())

module.exports = { timestamp }
