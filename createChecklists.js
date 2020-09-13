const meow = require('meow')
const fs = require('fs').promises
const Papa = require('papaparse')
const comments = require('./comments.json')
const cli = meow(`
  Usage
    $ node createChecklists.js input [opts]

  Arguments
    input       The input file

  Options
    --start     The starting time
    --ends      An end time
    --export    Export results to a file

  Examples
    $ node createChecklists.js
    $ node createChecklists.js --start="2020/09/04 21:30:00" --end="2020/09/07 23:00:00" --export="2020-09-07 recorded"
`, {
  flags: {
    start: {
      type: 'string'
    },
    end: {
      type: 'string'
    },
    export: {
      type: 'string'
    }
  }
})
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

function getDates (input, opts) {
  const dates = {}
  const unique = _.uniq(_.map(input, (x) => {
    if (opts && opts.start && opts.end) {
      if (moment(x.real_detection_time, 'MM/DD/YY HH:mm:ss').isBetween(opts.start, opts.end)) {
        return x.date
      }
      // Drop any dates which don't match
    } else {
      return x.date
    }
  })).filter(x => x)
  unique.forEach(x => {
    dates[x] = {}
  })
  return dates
}

function getStart (recordingStart, opts) {
  if (opts && opts.start && recordingStart.isBefore(opts.start)) {
    return opts.start
  }
  return recordingStart
}

function makeHourBuckets (input, dates, opts) {
  const newDates = {}
  for (var k in dates) newDates[k] = {}

  _.forEach(Object.keys(newDates), date => {
    // It might be more contained for testing to include a dateObj in its own
    // object, instead of having to send input into this function
    const dateObj = _.find(input.data, ['date', date])
    if (dateObj) {
      const recordingStart = moment(`${dateObj.date} ${dateObj.recording_start}`, 'MM/DD/YY HH:mm:ss')
      const start = getStart(recordingStart, opts)
      // Figure out how many buckets to make
      const duration = moment.duration(dateObj.recording_length)
      let end = moment(recordingStart).add(duration)
      if (opts && opts.end &&
        // If it is either today, or if it is tomorrow but before noon
        (opts.end.isSame(start, 'day') || (opts.end.isSame(moment(start).add(1, 'day'), 'day') && opts.end.isBefore(moment(start).add(1, 'day').hour(12))))) {
        // This resets for each date, so make sure it doesn't end up making buckets all the way through to the end
        end = opts.end
      }
      if (start.isBefore(end)) {
        if (!newDates[start.format('MM/DD/YY')]) {
          newDates[start.format('MM/DD/YY')] = {}
        }
        // Add the initial time
        newDates[start.format('MM/DD/YY')][start.format('HH:mm:ss')] = []
        // Make an array of the times for that night
        let hourString
        let dateForHour = start.format('MM/DD/YY')
        // TODO I can't seem to start at 23:00. This whole thing needs help.
        for (let i = moment(start).add(1, 'hour').startOf('hour'); moment(i).isBefore(moment(end)); i.add(1, 'hours')) {
          if (moment(i).isAfter(moment(start), 'day')) {
            dateForHour = moment(date, 'MM/DD/YY').add(1, 'day').format('MM/DD/YY')
            if (!newDates[dateForHour]) {
              newDates[dateForHour] = {
                '00:00:00': []
              }
            }
          }
          hourString = `${i.hours().toString().padStart(2, '0')}:00:00`
          newDates[dateForHour][hourString] = []
        }
      }
    }
    if (_.isEmpty(newDates[date])) {
      delete newDates[date]
    }
  })
  return newDates
}

function findDetector (string) {
  return (string === 'tseep') ? 'Tseeps' : 'Thrushes'
}

function getDuration (buckets, date, hour, arr, key, opts) {
  function getRecordingEnd (entry) {
    return moment(`${entry.date} ${entry.recording_start}`, 'MM/DD/YY hh:mm:ss').add(moment.duration({
      hours: entry.recording_length.split(':')[0],
      minutes: entry.recording_length.split(':')[1],
      seconds: entry.recording_length.split(':')[2]
    }))
  }

  function getRecordingStart (entry) {
    return moment(`${entry.date} ${entry.recording_start}`, 'MM/DD/YY hh:mm:ss')
  }

  if (buckets[date][hour] && buckets[date][hour].length === 0) {
    return null
  }

  let end = (opts && opts.end) ? opts.end : getRecordingEnd(buckets[date][hour][0])
  let start = (opts && opts.start) ? opts.start : getRecordingStart(buckets[date][hour][0])

  if (opts && opts.start) {
    if (buckets[date][hour][0] && opts.start.isBefore(getRecordingStart(buckets[date][hour][0]))) {
      start = getRecordingStart(buckets[date][hour][0])
    }
  }
  if (opts && opts.end) {
    if (buckets[date][hour][0] && opts.end.isAfter(getRecordingEnd(buckets[date][hour][0]))) {
      end = getRecordingEnd(buckets[date][hour][0])
    }
  }

  // If the checklist ends within an hour
  if (moment(`${date} ${hour}`, 'MM/DD/YY HH:mm:ss').isSame(end, 'hour')) {
    // Subtract the start time if it is in the same hour
    if (moment(`${date} ${hour}`, 'MM/DD/YY HH:mm:ss').isSame(start, 'hour')) {
      return end.minutes() - start.minutes()
    // Or just use the amount of minutes in the hour
    } else {
      return end.minutes()
    }
  } else if (moment(`${date} ${hour}`, 'MM/DD/YY HH:mm:ss').isSame(start, 'hour')) {
    return 60 - start.minutes()
  }

  return 60
}

function printResults (input, buckets, opts) {
  let counts
  const totalCounts = {}
  const detector = findDetector(input.data[0].detector)
  Object.keys(buckets).forEach(date => {
    if (Object.keys(buckets[date]).filter(x => buckets[date][x].length !== 0).length) {
      console.log('')
      console.log(chalk.blue(`Date: ${date}`))
      Object.keys(buckets[date]).forEach((hour, key, arr) => {
        if (buckets[date][hour].length !== 0) {
          console.log(`Hour: ${chalk.green(hour.split(':').slice(0, 2).join(':'))}`)
          const duration = getDuration(buckets, date, hour, arr, key, opts)
          if (duration) {
            console.log(`Duration: ${chalk.white(duration)} mins.`)
          }
          console.log('Species\tBirds\tNFCs')
          counts = _.countBy(buckets[date][hour], 'species')
          Object.keys(counts).forEach(species => {
            const birdEstimate = estimateBirdsCalling(buckets[date][hour], species)
            if (!totalCounts[date]) {
              totalCounts[date] = {}
            }
            if (!totalCounts[date][species]) {
              totalCounts[date][species] = {
                NFCs: counts[species],
                birds: birdEstimate
              }
            } else {
              totalCounts[date][species].NFCs += counts[species]
              totalCounts[date][species].birds += birdEstimate
            }

            if (species === '') {
              console.log(`${detector}:\t${birdEstimate}\t(${counts[species]})`)
              // Flag errors often causes by pressing 'N' meaning 'Next'
            } else if (species === 'nowa') {
              console.log(chalk.red(`NOWA:\t ${counts[species]}`))
            } else {
              console.log(`${species.toUpperCase()}:\t${birdEstimate}\t(${counts[species]})`)
            }
          })
          console.log('')
        }
      })
    }
  })
  // TODO Allow for thrushes, too
  Object.keys(totalCounts).forEach(date => {
    console.log(chalk.blue(date + ' totals:'))
    Object.keys(totalCounts[date]).forEach(species => {
      console.log(`${(species === '') ? 'Unidentified tseeps' : species.toUpperCase()}: ${totalCounts[date][species].birds} probable ${(totalCounts[date][species].birds === 1) ? 'bird' : 'birds'}, with ${totalCounts[date][species].NFCs} total calls.`)
    })
    console.log('')
  })
}

function estimateBirdsCalling (array, species) {
  const format = 'HH:mm:ss'
  const calls = _.map(_.filter(array, x => x.species === species), 'detection_time')
  let dupes = 0
  calls.forEach((time, index, array) => {
    if (-moment(time, format).diff(moment(array[index + 1], format), 'seconds') <= 15) {
      dupes++
    }
  })
  return calls.length - dupes
}

async function exportResults (input, buckets, opts) {
  const codesFile = Papa.parse(await fs.readFile('codes.csv', 'utf8'), { header: true })
  const codes = {}
  _.forEach(codesFile.data, x => {
    codes[x.Code] = x.Species
  })
  const output = []

  const eBirdReportObj = {
    'Common Name': '', // waterfowl sp.
    Genus: '',
    Species: '',
    Number: '', // 38
    'Species Comments': '', // 1 NFC.
    'Location Name': 'Monsignor Crosby Ave (Yard)', //
    Latitude: '44.258034',
    Longitude: '-72.574655',
    Date: '', // 9/7/2020
    'Start Time': '', // 3:00 AM
    'State/Province': 'VT',
    'Country Code': 'US',
    Protocol: 'stationary', // Needs to be changed manually in eBird.
    'Number of Observers': '1',
    Duration: '', // 60
    'All observations reported?': 'N',
    'Effort Distance Miles': '',
    'Effort area acres': '',
    'Submission Comments': 'Recorded using an OldBird 21c microphone, recording to a NUC7CHYJ using I-Recorded on Windows 10, at 22050Hz, mono, 16bit. Calls detected using Vesper (https://github.com/HaroldMills/Vesper). This checklist was created automatically using https://github.com/RichardLitt/vesper-scripts.'
  }

  let counts
  Object.keys(buckets).forEach(date => {
    Object.keys(buckets[date]).forEach((hour, key, arr) => {
      if (hour.length !== 0) {
        counts = _.countBy(buckets[date][hour], 'species')
        Object.keys(counts).forEach(species => {
          const birdEstimate = estimateBirdsCalling(buckets[date][hour], species)
          const object = {}
          Object.assign(object, eBirdReportObj)
          object.Number = birdEstimate
          object.Date = moment(date, 'MM/DD/YY').format('M/DD/YYYY')
          object['Start Time'] = hour.split(':').slice(0, 2).join(':')
          object.Duration = getDuration(buckets, date, hour, arr, key, opts)
          let speciesComment = `${counts[species]} NFC.<br><br> Detected automatically using Vesper ${input.data[0].detector} detector, available at https://github.com/HaroldMills/Vesper. Manually identified using Vesper by me. More justification for this identification available upon request; here, without researching extensively, I was able to identify the call as being very typical of this species, based on known recordings I've seen.`
          // If there is a comment from the comments page, use that
          if (comments[species.toUpperCase()] && !comments[species.toUpperCase()].WIP) {
            speciesComment = `${counts[species]} NFC.<br><br> ${comments[species.toUpperCase()].text} All NFC calls identified here follow this pattern, unless noted. If the number of identified calls does not match the NFC count, it is because the calls occurred close enough to each other to make it unclear whether or not a single bird was calling.<br><br> For more on ${species.toUpperCase()} NFC identification, consult this checklist ${comments[species.toUpperCase()].example}, or the updated page at https://birdinginvermont.com/nfc-species/${species}.`
          }
          object['Species Comments'] = speciesComment.replace(/\n/g, '<br>')
          if (species === '') {
            object['Common Name'] = 'passerine sp.'
          } else if (species === 'nowa') {
            console.log(chalk.red(`You saw ${counts[species]} NOWA species - is that right? Or did you click N by accident?`))
          } else {
            object['Common Name'] = codes[species.toUpperCase()]
          }
          output.push(object)
        })
      }
    })
  })

  fs.writeFile(`${cli.flags.export.replace(/\.csv/, '')}.csv`, Papa.unparse(output, { header: false }), 'utf8')
}

async function run () {
  const input = await getData(cli.input[0])
  let opts
  if ((!cli.flags.start && cli.flags.end) || (cli.flags.start && !cli.flags.end)) {
    console.log('You need both a start and an end date')
    process.exit(1)
  }
  if (cli.flags.start && cli.flags.end) {
    opts = {
      start: moment(cli.flags.start, 'YYYY/MM/DD HH:mm:ss'),
      end: moment(cli.flags.end, 'YYYY/MM/DD HH:mm:ss'),
      endingHour: moment(this.end).startOf('hour'),
      finalDuration: moment(this.end).minutes()
    }
    if (opts.end.isBefore(opts.start)) {
      console.log('The end cannot precede the beginning.')
      process.exit(1)
    }
  }

  function putEntryInBucket (entry) {
    // Set the hour to match the bucket name
    let hour = `${date.hour().toString().padStart(2, '0')}:00:00`
    const recordingStart = getStart(moment(entry.date + ' ' + entry.recording_start, 'MM/DD/YY HH:mm:ss'), opts)
    if (date.isSame(recordingStart, 'hour')) {
      hour = recordingStart.format('HH:mm:ss')
    }
    if (opts && opts.start && opts.start.isSame(date, 'hour') && !opts.start.isBefore(date)) {
      hour = opts.start.format('HH:mm:ss')
    }

    buckets[date.format('MM/DD/YY')][hour].push(entry)
  }

  const dates = getDates(input.data, opts)

  // Put all of the sightings into collections of hours
  // This is because eBird requests all checklists be under an hour
  const buckets = makeHourBuckets(input, dates, opts)
  let date
  input.data.forEach(entry => {
    date = moment(entry.real_detection_time, 'MM/DD/YY HH:mm:ss')
    if (opts && opts.start && opts.end) {
      if (date.isBetween(opts.start, opts.end)) {
        putEntryInBucket(entry)
      }
    } else {
      putEntryInBucket(entry)
    }
  })

  printResults(input, buckets, opts)
  if (cli.flags.export === '') {
    console.log('Please provide an export file name')
    process.exit(1)
  }
  if (cli.flags.export) {
    exportResults(input, buckets, opts)
  }
}

run()

module.exports = {
  makeHourBuckets,
  getStart
}
