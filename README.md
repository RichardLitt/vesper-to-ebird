# Vesper Scripts

The only script here automatically creates a list of what birds you've identified in any given hour from a Vesper .csv printout.

## Usage

```sh
node createChecklists.js 2020-09\ Output.csv
```

## Example Vesper .csv printout as JSON

```json
{
  "season": "Fall",
  "year": "2020",
  "detector": "tseep",
  "species": "bbwa",
  "site": "MSGR",
  "date": "09/01/20",
  "recording_start": "21:09:32",
  "recording_length": "7:21:27",
  "detection_time": "0:39:12",
  "real_detection_time": "09/01/20 21:48:44",
  "rounded_to_half_hour": "22:00:00",
  "duplicate": "no",
  "sunset": "09/01/20 19:39:15",
  "civil_dusk": "09/01/20 20:08:06",
  "nautical_dusk": "09/01/20 20:42:34",
  "astronomical_dusk": "09/01/20 21:18:43",
  "astronomical_dawn": "09/02/20 04:53:11",
  "nautical_dawn": "09/02/20 05:29:21",
  "civil_dawn": "09/02/20 06:03:51",
  "sunrise": "09/02/20 06:32:44",
  "moon_altitude": "17.6",
  "moon_illumination": "99.8"
}
```

## Contribute

Go ahead! Ping me first, though.

## License

MIT