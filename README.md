# Vesper to Ebird

This tool automatically converts [Vesper](https://github.com/HaroldMills/vesper) CSV exports into appropriate NFC checklists suitable for importing into eBird. 

## Usage

```sh
Usage
  $ node createChecklists.js input [opts]

Arguments
  input       The input file

Options
  --config    Path to a configuration json file
  --start     The starting time
  --ends      An end time
  --date      Specify a single date
  --export    Export results to a file

Examples
  $ node createChecklists.js output.csv
  $ node createChecklists.js output.csv --start="2020/09/04 21:30:00" --end="2020/09/07 23:00:00" --export="2020-09-07 recorded"
  $ node createChecklists.js output.csv --date="2020/09/08"
  $ node createChecklists.js -c ~/mytotallysecret/settings.json output.csv --date="2020/09/08"
```

### Settings

The settings file represents an individual setup, with examples in [./settings.json](./settings.json)

Specific settings can be used via the command line option `--config`, passing a path to a viable json file, or by settins the `VESPER_TO_EBIRD_SETTINGS` as a path to the desired configuration file. Below are examples of each.

`--config`
```
$ node createChecklists.js --config ~/.birdzallday/settings.json output.csv
```

`ENV variable`

```
$ export VESPER_TO_EBIRD_SETTINGS=~/.birdzallday/settings.json
$ node createChecklists.js output.csv
```

## Contribute

Go ahead! Ping me first, though.

## License

[MIT](LICENSE) © Richard Littauer
