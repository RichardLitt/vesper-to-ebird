#!/usr/bin/env node
const meow = require('meow')
const fs = require('fs').promises
const Papa = require('papaparse')
const codesFile = require('./codes.json')

const cli = meow(`
  Usage
    $ vesper-to-ebird input [opts]

  Arguments
    input        The input file or files, space delimited

  Options
    --config     Optional path containing configuration
    --start      The starting time
    --stop       An end time
    --date       Specify a single date
    --station    Specify the station manually
    --export     Export results to a file

  Examples
    $ vesper-to-ebird input.csv
    $ vesper-to-ebird input.csv input2.csv
    $ vesper-to-ebird input.csv --start="2020/09/04 21:30:00" --stop="2020/09/07 23:00:00" --export="2020-09-07 recorded"
    $ vesper-to-ebird input.csv --date="2020/09/08"
    $ vesper-to-ebird input.csv --station="NBNC"
    $ vesper-to-ebird --config ~/mytotallysecret/settings.json input.csv --date="2020/09/08"
    $ VESPER_TO_EBIRD_SETTINGS=~/mytotallysecret/settings.json vesper-to-ebird input.csv --date="2020/09/08"
`, {
  flags: {
    config: {
      type: 'string',
      alias: 'c'
    },
    start: {
      type: 'string'
    },
    stop: {
      type: 'string'
    },
    export: {
      type: 'string',
      alias: 'e'
    },
    date: {
      type: 'string',
      alias: 'd'
    },
    station: {
      type: 'string',
      default: 'NBNC'
    }
  }
})

/**
 * settings evaluates the location of settings in this order: ENV, cli, default
 *
 * @param {*} path file URL for settings
 */
function settings (path) {
  if (process.env.VESPER_TO_EBIRD_SETTINGS !== '') {
    // user has provided their own settings file via environment variable
    return process.env.VESPER_TO_EBIRD_SETTINGS
  } else if (cli.flags.config) {
    // user has provided their own settings file via cli option
    return cli.flags.config
  } else {
    // return the default settings file
    return './settings.json'
  }
}

const comments = require(settings()).species
const stations = require(settings()).stations
const slashCodes = require(settings()).slashCodes

const _ = require('lodash')
const moment = require('moment')
const chalk = require('chalk')

async function getData (input) {
  let data = []

  for (let file in input) {
    file = await fs.readFile(input[file], 'utf8')
    file = Papa.parse(file, { header: true })
    // Remove newline at end of file
    data = data.concat(file.data.filter(x => x.season !== ''))
  }

  return data
}

function getDates (input, opts) {
  const dates = {}
  const unique = _.uniq(_.map(input, (x) => {
    if (opts && opts.start && opts.stop) {
      if (moment(x.real_detection_time, 'MM/DD/YY HH:mm:ss').isBetween(opts.start, opts.stop)) {
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

    // Get any sessions per day. This is normally only , if started and stopped once per night.
    // TODO Add tests for this
    const sessions = _.uniq(_.map(_.filter(input, e => e.date === date), entry => {
      return entry.recording_start
    }))

    sessions.forEach(session => {
      // This will break if there are multiple different recording_starts per date
      const dateObj = _.find(_.filter(input, e => e.date === date), ['recording_start', session])
      if (dateObj) {
        const recordingStart = moment(`${dateObj.date} ${dateObj.recording_start}`, 'MM/DD/YY HH:mm:ss')
        const start = getStart(recordingStart, opts)
        // Figure out how many buckets to make
        const duration = moment.duration(dateObj.recording_length)
        let end = moment(recordingStart).add(duration)
        if (opts && opts.stop &&
          // If it is either today, or if it is tomorrow but before noon
          (opts.stop.isSame(start, 'day') || (opts.stop.isSame(moment(start).add(1, 'day'), 'day') && opts.stop.isBefore(moment(start).add(1, 'day').hour(12))))) {
          // This resets for each date, so make sure it doesn't end up making buckets all the way through to the end
          end = opts.stop
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
    })
    if (_.isEmpty(newDates[date])) {
      delete newDates[date]
    }
  })
  return newDates
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

  let end = (opts && opts.stop) ? opts.stop : getRecordingEnd(buckets[date][hour][0])
  let start = (opts && opts.start) ? opts.start : getRecordingStart(buckets[date][hour][0])

  if (opts && opts.start) {
    if (buckets[date][hour][0] && opts.start.isBefore(getRecordingStart(buckets[date][hour][0]))) {
      start = getRecordingStart(buckets[date][hour][0])
    }
  }
  if (opts && opts.stop) {
    if (buckets[date][hour][0] && opts.stop.isAfter(getRecordingEnd(buckets[date][hour][0]))) {
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
  Object.keys(buckets).sort().forEach(date => {
    if (Object.keys(buckets[date]).filter(x => buckets[date][x].length !== 0).length) {
      console.log('')
      console.log(chalk.blue(`Date: ${date}`))
      Object.keys(buckets[date]).sort().forEach((hour, key, arr) => {
        if (buckets[date][hour].length !== 0) {
          console.log(`Hour: ${chalk.green(hour.split(':').slice(0, 2).join(':'))}`)
          const duration = getDuration(buckets, date, hour, arr, key, opts)
          if (duration) {
            console.log(`Duration: ${chalk.white(duration)} mins.`)
          }
          console.log('Species\tBirds\tNFCs')
          counts = _.countBy(buckets[date][hour], 'species')
          Object.keys(counts).sort((a, b) => a.length - b.length).forEach(species => {
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

            // This shows how many thrushes or tseeps were called
            // console.log(_.countBy(buckets[date][hour], value => value.detector))

            // Flag errors often causes by pressing 'N' meaning 'Next'
            if (species === 'nowa') {
              console.log(chalk.red(`NOWA:\t ${counts[species]}`))
            } else if (species.includes('sp.')) {
              console.log(`${species.charAt(0).toUpperCase() + species.slice(1)}:\t${birdEstimate}\t(${counts[species]})`)
            } else {
              console.log(`${species.toUpperCase()}:\t${birdEstimate}\t(${counts[species]})`)
            }
          })
          console.log('')
        }
      })
    }
  })

  Object.keys(totalCounts).forEach(date => {
    console.log(chalk.blue(date + ' totals:'))
    Object.keys(totalCounts[date]).sort((a, b) => a.length - b.length).forEach(species => {
      let name
      if (species.includes('sp.')) {
        name = species.charAt(0).toUpperCase() + species.slice(1)
      } else {
        name = species.toUpperCase()
      }
      console.log(`${name}: ${totalCounts[date][species].birds} probable ${(totalCounts[date][species].birds === 1) ? 'bird' : 'birds'}, with ${totalCounts[date][species].NFCs} total calls.`)
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
  const codes = Object.assign(slashCodes)
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
    'Location Name': stations[opts.station]['Location Name'],
    Latitude: stations[opts.station].Latitude,
    Longitude: stations[opts.station].Longitude,
    Date: '', // 9/7/2020
    'Start Time': '', // 3:00 AM
    'State/Province': stations[opts.station].State,
    'Country Code': 'US',
    Protocol: 'P54', // Code for NFCP.
    'Number of Observers': '1',
    Duration: '', // 60
    'All observations reported?': 'N',
    'Effort Distance Miles': '',
    'Effort area acres': '',
    'Submission Comments': `${stations[opts.station].Kit} Calls detected using Vesper (https://github.com/HaroldMills/Vesper) unless noted. This checklist was created automatically using https://github.com/RichardLitt/vesper-to-ebird.`
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
          let speciesComment = `${counts[species]} NFC.<br><br> Detected automatically using Vesper, available at https://github.com/HaroldMills/Vesper. Classified manually using Vesper by me. More justification for this identification available upon request; here, without researching extensively, I was able to identify the call as being very typical of this species, based on known recordings I've seen.`
          // If there is a comment from the comments page, use that
          if (comments[species.toUpperCase()] && !comments[species.toUpperCase()].WIP) {
            speciesComment = `${counts[species]} NFC.<br><br> ${comments[species.toUpperCase()].text} All NFC calls identified here follow this pattern, unless noted. If the number of identified calls does not match the NFC count, it is because the calls occurred close enough to each other to make it unclear whether or not a single bird was calling.<br><br> For more on ${species.toUpperCase()} NFC identification, consult this checklist ${comments[species.toUpperCase()].example}, or the updated page at https://birdinginvermont.com/nfc-species/${species}.`
          }
          object['Species Comments'] = speciesComment.replace(/\n/g, '<br>')
          if (species.includes('sp.')) {
            object['Common Name'] = taxonomicMatching.commonName(species)
            object['Species Comments'] = `${counts[species]} NFC.<br><br> Detected automatically in the sound file using Vesper, available at https://github.com/HaroldMills/Vesper. Classified manually by me. All tseeps and most thrush calls are given by passerine species, to the best of my knowledge; any extraneous noises were not included in this count. Any call that was within fifteen seconds of another call of the previous call was not counted in the species total in order to ensure under- and not overcounts. The actual number may vary significantly. Vesper may also fail to identify many calls, so accuracy should not be assumed in this call count. The NFC number in this comment is the total amount of calls identifed by Vesper.`
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

// Shim what Vesper can identify to the nearest eBird taxonomic designation
const taxonomicMatching = {
  species: function () {
    return Object.keys(this.matches)
  },
  matches: {
    '': 'passerine sp.', // Both tseep and thrush classifiers default to passerine. Some issues - swallows? Cuckoos?
    unkn: 'bird sp.', // This will default to passerine sp., based on tseep and thrush sp mostly naming these species.
    zeep: 'warbler sp. (Parulidae sp.)', // All zeeps are warblers.
    sparrow: 'sparrow sp.',
    peep: 'peep sp.'
  },
  commonName: function (designation) {
    if (this.species().includes(designation)) {
      return this.matches[designation]
    }
    return designation
  }
}

function putEntryInBucket (entry, date, buckets, opts) {
  entry.species = taxonomicMatching.commonName(entry.species)
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

async function run () {
  const input = await getData(cli.input)
  const opts = {}
  if ((!cli.flags.start && cli.flags.stop) || (cli.flags.start && !cli.flags.stop)) {
    console.log('You need both a start and an end date')
    process.exit(1)
  }
  if (cli.flags.date) {
    opts.start = moment(cli.flags.date, 'YYYY/MM/DD').hour(12)
    opts.stop = moment(cli.flags.date, 'YYYY/MM/DD').hour(12).add(1, 'day')
  } else if (cli.flags.start && cli.flags.stop) {
    opts.start = moment(cli.flags.start, 'YYYY/MM/DD HH:mm:ss')
    opts.stop = moment(cli.flags.stop, 'YYYY/MM/DD HH:mm:ss')
    if (opts.stop.isBefore(opts.start)) {
      console.log('The end cannot precede the beginning.')
      process.exit(1)
    }
  }
  // TODO Validate better, default to one in settings, let us know what one you're using if more than two
  opts.station = (cli.flags.station) ? cli.flags.station : 'NBNC'

  const dates = getDates(input, opts)

  // Put all of the sightings into collections of hours
  // This is because eBird requests all checklists be under an hour
  const buckets = makeHourBuckets(input, dates, opts)
  let date
  input.forEach(entry => {
    date = moment(entry.real_detection_time, 'MM/DD/YY HH:mm:ss')
    if (opts && opts.start && opts.stop) {
      if (date.isBetween(opts.start, opts.stop)) {
        putEntryInBucket(entry, date, buckets, opts)
      }
    } else {
      putEntryInBucket(entry, date, buckets, opts)
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
