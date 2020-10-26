# Vesper to Ebird

This tool automatically converts [Vesper](https://github.com/HaroldMills/vesper) CSV exports into appropriate NFC checklists suitable for importing into eBird.

## Install

You need to have [Node.js](https://nodejs.org/en/) installed on your computer to use this program. Once you have node, you will automatically have npm installed, too. From your terminal, run this command:

`npm i -g vesper-to-ebird`

You will need to be comfortable with using your Terminal. I am not familiar with how to run this on Windows; I would suggest using something like [Git BASH](https://gitforwindows.org/) for using Bash and Node on Windows.

You'll also need to have Vesper installed and running; the input files this program expects can be exported as CSV files from Vesper's web client.

## Usage

```sh
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
