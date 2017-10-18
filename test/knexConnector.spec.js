const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const knex = require('knex')
const { job } = require('@desmart/queue')

const knexConnector = require('../')
const knexConfig = require('../knexfile')

chai.use(sinonChai)

const { expect } = chai

const retryAfter = 60

const dateToSeconds = date => Math.round(new Date(date).getTime() / 1000, 0)

describe('knexConnector', () => {
  let connection
  let connector

  before(() => {
    connection = knex(knexConfig.development)
    connector = knexConnector({ knex: connection, retryAfter })
  })

  afterEach(() => {
    return connection.table('jobs').delete()
  })

  it('pushes job to database', async () => {
    const clock = sinon.useFakeTimers({
      now: Date.now()
    })
    const testJob = job.of('test.job', { foo: 1 })
    const id = await connector.push(testJob)
    const dbRecord = await connection.table('jobs')
      .where({ id })
      .first()

    expect(dbRecord).to.deep.include({
      queue: testJob.queue,
      payload: JSON.stringify(testJob),
      attempts: 0,
      reserved_at: null
    })

    expect(dateToSeconds(dbRecord.created_at)).to.equal(dateToSeconds(new Date()))

    clock.restore()
  })

  it('pops first available job', async () => {
    await connector.push(job.of('test.job'))
    const newJob = await connector.pop('default')

    expect(newJob).to.exist // eslint-disable-line
    expect(newJob.toJSON()).to.deep.include({
      name: 'test.job',
      payload: {},
      attempts: 1,
      queue: 'default'
    })
  })

  describe('job actions', () => {
    it('allows to remove job', async () => {
      const jobId = await connector.push(job.of('test.job'))
      const newJob = await connector.pop('default')

      await newJob.remove()

      const [{ count }] = await connection.table('jobs')
        .where({ id: jobId })
        .count('id as count')

      expect(count).to.equal(0)
    })

    it('allows to release job', async () => {
      const clock = sinon.useFakeTimers({ now: Date.now() })

      const jobId = await connector.push(job.of('test.job'))
      const newJob = await connector.pop('default')

      await newJob.release(60)

      const dbRecord = await connection.table('jobs')
        .where({ id: jobId })
        .first()

      expect(dbRecord.reserved_at).to.equal(null)
      expect(dateToSeconds(dbRecord.available_at)).to.equal(dateToSeconds(Date.now() + 60000))

      clock.restore()
    })
  })
})
