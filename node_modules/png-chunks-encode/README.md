# png-chunks-encode

[![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

Return a fresh PNG buffer given a set of PNG chunks. Useful in combination with [png-chunks-encode](https://github.com/hughsk/png-chunks-extract) to easily modify or add to the data of a PNG file.

By adding your own `tEXt` or `zEXt` chunks you have a useful alternative to LSB steganography for making "magical" images with "secret" data available for your applications: the data is hardly hidden this way, but you can store as much as you like. If you really wanted to, you could probably get away with sneaking a 300MB 3D model in there without too much trouble 👻

## Usage

[![NPM](https://nodei.co/npm/png-chunks-encode.png)](https://www.npmjs.com/package/png-chunks-encode)

### `buffer = encode(chunks)`

Takes an array of `chunks`, each with a `name` and `data`:

``` javascript
[
  { name: 'IHDR', data: Uint8Array([...]) },
  { name: 'IDAT', data: Uint8Array([...]) },
  { name: 'IDAT', data: Uint8Array([...]) },
  { name: 'IDAT', data: Uint8Array([...]) },
  { name: 'IDAT', data: Uint8Array([...]) },
  { name: 'IEND', data: Uint8Array([]) }
]
```

And returns a `Uint8Array` containing the raw PNG buffer.

## See Also

* [png-chunks-extract](https://github.com/hughsk/png-chunks-extract)

## License

MIT, see [LICENSE.md](http://github.com/hughsk/png-chunks-encode/blob/master/LICENSE.md) for details.
