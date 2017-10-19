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

const dateToSeconds = date => Math.floor(new Date(date).getTime() / 1000, 0)

describe('knexConnector', () => {
  let connection
  let connector
  let clock

  before(() => {
    connection = knex(knexConfig[env])
    connector = knexConnector({ knex: connection, retryAfter })
  })

  after(() => {
    return connection.destroy()
  })

  afterEach(() => {
    clock && clock.restore()
    clock = null

    return connection.table('jobs').delete()
  })

  it('pushes job to database', async () => {
    clock = sinon.useFakeTimers({
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

    expect(dbRecord.created_at).to.equal(dateToSeconds(new Date()))
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

      expect(parseInt(count)).to.equal(0)
    })

    it('allows to release job', async () => {
      clock = sinon.useFakeTimers({ now: Date.now() })

      const jobId = await connector.push(job.of('test.job'))
      const newJob = await connector.pop('default')

      await newJob.release(60)

      const dbRecord = await connection.table('jobs')
        .where({ id: jobId })
        .first()

      expect(dbRecord.reserved_at).to.equal(null)
      expect(dbRecord.available_at).to.equal(dateToSeconds(Date.now()) + 60)
    })

    it('increments released job attempts', async () => {
      await connector.push(job.of('test.job'))

      await connector.pop('default').then(job => job.release())
      const newJob = await connector.pop('default')

      expect(newJob.attempts).to.equal(2)
    })
  })

  describe('reserved_at', () => {
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

  describe('available_at', () => {
    it('cant take job which was released with delay', async () => {
      await connector.push(job.of('test.job'))
      const newJob = await connector.pop('default')

      await newJob.release(60)

      const nextJob = await connector.pop('default')

      expect(nextJob).to.equal(null)
    })
  })

  describe('listen', () => {
    const noop = () => {}
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

    afterEach(() => {
      connector.onJob(noop)
    })

    it('fetch first available job', async () => {
      const newJob = job.of('test.job', { foo: 1 })
      await connector.push(newJob)

      const spy = sinon.spy()
      connector.onJob(spy)

      const stop = connector.listen('default', { wait: 0.1 })
      await wait(150)

      stop()

      expect(spy).to.have.been.calledOnce // eslint-disable-line
      expect(spy.getCall(0).args[0].toJSON()).to.deep.include(newJob.increment().toJSON())
    })

    it('fetches next jobs', async () => {
      await connector.push(job.of('test.job'))
      await connector.push(job.of('test.job'))

      const stub = sinon.stub()
      stub.callsFake(job => {
        job.remove()
      })

      connector.onJob(stub)

      const stop = connector.listen('default', { wait: 0.2 })
      await wait(500)

      stop()

      expect(stub).to.have.been.calledTwice // eslint-disable-line
    })

    it('fetches back released job', async () => {
      await connector.push(job.of('test.job'))

      const stub = sinon.stub()
      stub.callsFake(job => {
        if (job.attempts === 1) {
          job.release(0.5)
        } else {
          job.remove()
        }
      })

      connector.onJob(stub)

      const stop = connector.listen('default', { wait: 0.5 })
      await wait(2000)

      stop()

      expect(stub).to.have.been.calledTwice // eslint-disable-line
    })
    .timeout(3000)
  })
})
