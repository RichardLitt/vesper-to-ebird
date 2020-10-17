# Vesper to Ebird

This tool automatically converts [Vesper](https://github.com/HaroldMills/vesper) CSV exports into appropriate NFC checklists suitable for importing into eBird. 

## Usage

```sh
Usage
  $ node createChecklists.js input [opts]

Arguments
  input       The input file

Options
  --start     The starting time
  --ends      An end time
  --date      Specify a single date
  --station   Specify the station manually
  --export    Export results to a file

Examples
  $ node createChecklists.js input.csv
  $ node createChecklists.js input.csv,input2.csv
  $ node createChecklists.js input.csv --start="2020/09/04 21:30:00" --end="2020/09/07 23:00:00" --export="2020-09-07 recorded"
  $ node createChecklists.js input.csv --date="2020/09/08"
  $ node createChecklists.js input.csv --station="NBNC"
```

## Contribute

Go ahead! Ping me first, though.

## License

[MIT](LICENSE) © Richard Littauer
