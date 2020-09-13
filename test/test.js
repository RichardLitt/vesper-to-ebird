/* eslint-env mocha */
const t = require('../createChecklists')
const chai = require('chai')
const assert = chai.assert
const moment = require('moment')
chai.use(require('chai-moment'))

const input = {
  data: [{
    season: 'Fall',
    year: '2020',
    detector: 'tseep',
    species: '',
    site: 'MSGR',
    date: '09/08/20',
    recording_start: '20:43:00',
    recording_length: '8:21:00',
    detection_time: '0:00:37',
    real_detection_time: '09/08/20 20:43:37',
    rounded_to_half_hour: '20:30:00',
    duplicate: '',
    sunset: '09/08/20 19:27:09',
    civil_dusk: '09/08/20 19:55:37',
    nautical_dusk: '09/08/20 20:29:23',
    astronomical_dusk: '09/08/20 21:04:26',
    astronomical_dawn: '09/09/20 05:02:45',
    nautical_dawn: '09/09/20 05:37:49',
    civil_dawn: '09/09/20 06:11:38',
    sunrise: '09/09/20 06:40:07',
    moon_altitude: '-18.2',
    moon_illumination: '63.2'
  }]
}
const expectedResults = {
  '09/08/20': {
    '20:43:00': [],
    '21:00:00': [],
    '22:00:00': [],
    '23:00:00': []
  },
  '09/09/20': {
    '00:00:00': [],
    '01:00:00': [],
    '02:00:00': [],
    '03:00:00': [],
    '04:00:00': [],
    '05:00:00': [] // Dawn should end at 5:04 with this duration
  }
}
const dates = { '09/08/20': {} }

describe('makeHourBuckets()', function () {
  describe('without opts', function () {
    beforeEach(function () {
      this.currentTest.result = t.makeHourBuckets(input, dates)
    })
    it('should not modify the dates object argument', function () {
      assert.deepStrictEqual(dates, { '09/08/20': {} })
    })
    it('should create a new date for morning times', function () {
      assert.deepStrictEqual(Object.keys(this.test.result)[0], Object.keys(expectedResults)[0])
    })
    it('should start the bucket with the recording start', function () {
      assert.isTrue(Object.keys(this.test.result['09/08/20']).includes('20:43:00'))
    })
    it('should have no hours added to this date before the recording start', function () {
      Object.keys(this.test.result['09/08/20']).forEach(function (hour) {
        if (hour.split(':')[0] < '20') {
          assert.fail()
        }
      })
    })
    it('should add hours until midnight', function () {
      assert.hasAllKeys(this.test.result['09/08/20'], expectedResults['09/08/20'])
    })
    it('should create a new date for morning times', function () {
      assert.exists(this.test.result['09/09/20'])
    })
    it('should create midnight to have two zeroes', function () {
      assert.exists(this.test.result['09/09/20']['00:00:00'])
    })
    it('should add hours until the end of the duration', function () {
      assert.hasAllKeys(this.test.result['09/09/20'], expectedResults['09/09/20'])
    })
    // I had some issues with this pre-testing
    it('should still work if started after 23:00', function () {
      const newInput = {
        data: [{
          date: '09/08/20',
          recording_start: '23:43:00',
          recording_length: '4:00:00'
        }]
      }
      const result = t.makeHourBuckets(newInput, dates)
      assert.hasAllKeys(result['09/08/20'], { '23:43:00': [] })
      assert.hasAllKeys(result['09/09/20'], { '00:00:00': [], '01:00:00': [], '02:00:00': [], '03:00:00': [] })
    })

    // I had some issues with this pre-testing
    it('should still work if started on the hour', function () {
      const newInput = {
        data: [{
          date: '09/08/20',
          recording_start: '22:00:00',
          recording_length: '4:00:00'
        }]
      }
      const result = t.makeHourBuckets(newInput, dates)
      assert.hasAllKeys(result['09/08/20'], { '22:00:00': [], '23:00:00': [] })
      assert.hasAllKeys(result['09/09/20'], { '00:00:00': [], '01:00:00': [] })
    })

    it('should accout for milliseconds in start time', function () {
      const newInput = {
        data: [{
          date: '09/08/20',
          recording_start: '22:00:01',
          recording_length: '4:00:00'
        }]
      }
      const result = t.makeHourBuckets(newInput, dates)
      assert.hasAllKeys(result['09/08/20'], { '22:00:01': [], '23:00:00': [] })
      assert.hasAllKeys(result['09/09/20'], { '00:00:00': [], '01:00:00': [], '02:00:00': [] })
    })
  })

  describe('with opts', function () {
    it('should start the bucket with the opts start if it is valid', function () {
      const result = t.makeHourBuckets(input, dates, { start: moment('2020-09-08T20:45:00-04:00') })
      assert.isTrue(Object.keys(result['09/08/20']).includes('20:45:00'))
    })

    it('should not start the bucket with the opts start if it is before the start of the recording', function () {
      const result = t.makeHourBuckets(input, dates, { start: moment('2020-09-08T20:41:00-04:00') })
      assert.isTrue(Object.keys(result['09/08/20']).includes('20:43:00'))
    })

    it('should not start the bucket with the opts start if it is the wrong day', function () {
      const result = t.makeHourBuckets(input, dates, { start: moment('2020-09-09T20:43:00-04:00') })
      assert.isTrue(Object.keys(result['09/08/20']).includes('20:43:00'))
    })

    it('should not create a date for tomorrow if it ends before then', function () {
      const result = t.makeHourBuckets(input, dates, { end: moment('2020-09-08T21:43:00-04:00') })
      assert.isFalse(Object.keys(result).includes('09/09/20'))
    })

    it('should be able to start tomorrow', function () {
      const result = t.makeHourBuckets(input, dates, { start: moment('2020-09-09T01:43:00-04:00') })
      console.log('Result', result)
      assert.isFalse(Object.keys(result).includes('09/08/20'))
    })

    it('should be able to start and end tomorrow', function () {
      const result = t.makeHourBuckets(input, dates, { start: moment('2020-09-09T01:43:00-04:00'), end: moment('2020-09-09T04:32:00-04:00') })
      console.log('Result', result)
      assert.isFalse(Object.keys(result).includes('09/08/20'))
    })
  })
})

describe('getStart()', function () {
  beforeEach(function () {
    this.currentTest.testTime = moment('2020-09-13T10:07:59-04:00')
  })

  it('should return first arg if on same day', function () {
    assert.sameMoment(this.test.testTime, t.getStart(this.test.testTime, this.test.testTime.add(1, 'minute')))
  })

  it('should return first arg if on a different day', function () {
    assert.sameMoment(this.test.testTime, t.getStart(this.test.testTime, this.test.testTime.add(2, 'days')))
  })

  it('should return options arg if it is before the first arg on the same day', function () {
    assert.sameMoment(this.test.testTime, t.getStart(this.test.testTime.subtract(2, 'minute'), { start: this.test.testTime }))
  })

  it('should not return options arg if it is after the first arg on the same day', function () {
    assert.sameMoment(this.test.testTime.add(2, 'minute'), t.getStart(this.test.testTime.add(2, 'minute'), { start: this.test.testTime }))
  })
})

// TODO Add in opts
