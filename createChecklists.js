const meow = require('meow')
const fs = require('fs').promises
const Papa = require('papaparse')
const cli = meow()
const _ = require('lodash')
const moment = require('moment')
const chalk = require('chalk')

async function getData (input) {
  input = await fs.readFile(input, 'utf8')
  input = Papa.parse(input, { header: true })
  // Remove newline at end of file
  input.data = input.data.filter(x => x.season !== '')
  return input
}

function getDates (input) {
  return _.uniq(_.map(input.data, 'date')).filter(x => x)
}

function getRecordingEnd (entry) {
  const duration = entry.recording_length.split(':')[0]
  const momentDuration = moment.duration({
    hours: duration,
    minutes: entry.recording_length.split(':')[1],
    seconds: entry.recording_length.split(':')[2]
  })
  return moment(`${entry.date} ${entry.recording_start}`, 'MM/DD/YY hh:mm:ss').add(momentDuration)
}

function makeHourBuckets (input, dates) {
  _.forEach(Object.keys(dates), date => {
    const dateObj = _.find(input.data, ['date', date])
    // Add the initial time
    dates[date][dateObj.recording_start] = []
    // Figure out how many buckets to make
    const duration = dateObj.recording_length.split(':')[0]
    const momentDuration = moment.duration({
      hours: duration,
      minutes: dateObj.recording_length.split(':')[1],
      seconds: dateObj.recording_length.split(':')[2]
    })
    let startingHour = parseInt(dateObj.recording_start.split(':')[0])
    const endingHour = moment(`${dateObj.date} ${dateObj.recording_start}`, 'MM/DD/YY hh:mm:ss').add(momentDuration)
    // Make an array of the times for that night
    const automaticHourArray = []
    let hourString
    for (let i = 1; startingHour + i < 24 && i <= endingHour.hour(); (startingHour + i === 23) ? i = 0 : i++) {
      hourString = `${startingHour + i}:00:00`
      automaticHourArray.push(hourString)
      if (startingHour + i === 23) {
        startingHour = 0
        i = -1
      }
    }
    // Add the times to the date object, for the right day
    automaticHourArray.forEach(hour => {
      let newDate
      if (parseInt(hour.split(':')[0]) >= 12) {
        dates[date][hour] = []
      } else {
        newDate = moment(date, 'MM/DD/YY').add(1, 'day').format('MM/DD/YY')
        if (!dates[newDate]) {
          dates[newDate] = {}
        }
        dates[newDate][hour] = []
      }
    })
  })
  return dates
}

function findDetector (string) {
  return (string === 'tseep') ? 'Tseeps' : 'Thrushes'
}

async function run () {
  const input = await getData(cli.input[0])
  const dates = {}
  getDates(input).forEach(x => dates[x] = {})
  // Put all of the sightings into eBird hourly buckets
  const buckets = makeHourBuckets(input, dates)
  let date, counts
  input.data.forEach(entry => {
    date = moment(entry.real_detection_time, 'MM/DD/YY HH:mm:ss')
    let hour = `${date.hour()}:00:00`
    // console.log(moment(entry.recording_start, 'hh:mm:ss').hour())
    if (date.hour() === moment(entry.recording_start, 'HH:mm:ss').hour()) {
      hour = moment(entry.recording_start, 'HH:mm:ss').format('HH:mm:ss')
    }
    buckets[date.format('MM/DD/YY')][hour].push(entry)
  })

  const detector = findDetector(input.data[0].detector)
  Object.keys(buckets).forEach(date => {
    console.log('')
    console.log(chalk.blue(`Date: ${date}`))
    Object.keys(buckets[date]).forEach((hour, key, arr) => {
      if (!hour.includes(':00:00')) {
        console.log(`Hour: ${chalk.green(hour.split(':').slice(0, 2).join(':'))} (Duration: ${60 - parseInt(hour.split(':')[1])} mins.)`)
      } else if (Object.is(arr.length - 1, key) && hour !== '23:00:00') {
        // execute last item logic
        const recordingEnd = getRecordingEnd(buckets[date][hour][0])
        console.log(`Hour: ${chalk.green(hour.split(':').slice(0, 2).join(':'))} (Duration: ${recordingEnd.minutes()} mins.)`)
      } else {
        console.log(`Hour: ${chalk.green(hour.split(':').slice(0, 2).join(':'))}`)
      }
      counts = _.countBy(buckets[date][hour], 'species')
      Object.keys(counts).forEach(species => {
        if (species === '') {
          console.log(`${detector}:\t`, counts[species])
          // Flag errors often causes by pressing 'N' meaning 'Next'
        } else if (species === 'nowa') {
          console.log(chalk.red(`NOWA:\t ${counts[species]}`))
        } else {
          console.log(`${species.toUpperCase()}:\t`, counts[species])
        }
      })
      // let species = _.uniq(_.map(buckets[date][hour], 'species')).filter(x => x)
      // species.forEach(s => {
      //   console.log(`${s.toUpperCase()}: `, _.countBy(buckets[date][hour], 'species'))
      // })
      console.log('')
      // buckets[date][hour].(entry => {
      // console.log(_.uniq(_.map(input.data, 'date')).filter(x => x))
      // })
    })
  })
}

run()
