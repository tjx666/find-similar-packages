# find-similar-packages

![Version](https://img.shields.io/npm/v/@yutengjing/find-similar-packages)

find function similar packages in pnpm monorepo project

## Install

```sh
pnpm install -g @yutengjing/find-similar-packages
```

## Usage

```sh
Usage: find-similar-packages [options] /path/to/pnpm/monorepo/projectRoot

Options:
  -i, --ignore <regexp>       a regexp to specify which packages should be ignore
  -c, --concurrency <number>  concurrency count to check packages (default: "50")
  -V, --version               output the version number
  -h, --help                  display help for command
```

> **Note**
> For Chinese users, you need to set proxy

example output:

```txt
@vueuse/core    vue     vue-demi
await-to-js     bluebird
pinia   vue
qs      query-string
axios   vue     vue-router
add     dayjs
axios   bluebird        lodash
@handsontable/vue       handsontable
abortcontroller-polyfill        axios
exceljs handsontable    xlsx
file-saver      omggif
jszip   pako
jsqr    qrcode-reader
@babel/runtime  vue
```
