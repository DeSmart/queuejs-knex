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
const env = process.env.NODE_ENV || 'development'

const dateToSeconds = date => Math.round(new Date(date).getTime() / 1000, 0)

describe('knexConnector', () => {
  let connection
  let connector

  before(() => {
    connection = knex(knexConfig[env])
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

  describe('reserved_at', () => {
    let clock

    beforeEach(() => {
      clock = sinon.useFakeTimers({ now: Date.now() })
    })

    afterEach(() => {
      clock.restore()
    })

    it('cant take job which is reserved', async () => {
      await connector.push(job.of('test.job'))
      await connector.pop('default')

      const newJob = await connector.pop('default')
      expect(newJob).to.equal(null)
    })

    it('can take job which reservation expired', async () => {
      await connector.push(job.of('test.job'))
      await connector.pop('default')

      clock.tick(retryAfter * 1000)

      const newJob = await connector.pop('default')
      expect(newJob).to.exist // eslint-disable-line
    })
  })
})
