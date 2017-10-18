const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const chaiDateTime = require('chai-datetime')
const knex = require('knex')
const { job } = require('@desmart/queue')

const knexConnector = require('../')
const knexConfig = require('../knexfile')

chai.use(sinonChai)
chai.use(chaiDateTime)

const { expect } = chai

describe('knexConnector', () => {
  let connection
  let connector

  before(() => {
    connection = knex(knexConfig.development)
    connector = knexConnector({ knex: connection })
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

    expect(new Date(dbRecord.created_at)).to.equalDate(new Date())

    clock.restore()
  })
})
