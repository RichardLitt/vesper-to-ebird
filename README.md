# Vesper to Ebird

This tool automatically converts [Vesper](https://github.com/HaroldMills/vesper) CSV exports into appropriate NFC checklists suitable for importing into eBird.

## Install

`npm i -g vesper-to-ebird`

## Usage

```sh
Usage
  $ vesper-to-ebird input [opts]

Arguments
  input       The input file

Options
  --config    Path to a configuration json file
  --start     The starting time
  --ends      An end time
  --date      Specify a single date
  --station   Specify the station manually
  --export    Export results to a file

Examples
    $ vesper-to-ebird input.csv
    $ vesper-to-ebird input.csv,input2.csv
    $ vesper-to-ebird input.csv --start="2020/09/04 21:30:00" --end="2020/09/07 23:00:00" --export="2020-09-07 recorded"
    $ vesper-to-ebird input.csv --date="2020/09/08"
    $ vesper-to-ebird input.csv --station="NBNC"
    $ vesper-to-ebird --config ~/mytotallysecret/settings.json input.csv --date="2020/09/08"
    $ VESPER_TO_EBIRD_SETTINGS=~/mytotallysecret/settings.json vesper-to-ebird input.csv --date="2020/09/08"
```

### Settings

The settings file represents an individual setup, with examples in [./settings.json](./settings.json)

Specific settings can be used via the command line option `--config`, passing a path to a viable json file, or by settings the `VESPER_TO_EBIRD_SETTINGS` as a path to the desired configuration file. Below are examples of each.

`--config`
```
$ vesper-to-ebird --config ~/.birdzallday/settings.json output.csv
```

`ENV variable`

```
$ export VESPER_TO_EBIRD_SETTINGS=~/.birdzallday/settings.json
$ vesper-to-ebird output.csv
```

## Contribute

Go ahead! Ping me first, though.

## License

[MIT](LICENSE) © Richard Littauer
