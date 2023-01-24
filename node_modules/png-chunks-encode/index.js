var sliced = require('sliced')
var crc32 = require('crc-32')

module.exports = encodeChunks

// Used for fast-ish conversion between uint8s and uint32s/int32s.
// Also required in order to remain agnostic for both Node Buffers and
// Uint8Arrays.
var uint8 = new Uint8Array(4)
var int32 = new Int32Array(uint8.buffer)
var uint32 = new Uint32Array(uint8.buffer)

function encodeChunks (chunks) {
  var totalSize = 8
  var idx = totalSize
  var i

  for (i = 0; i < chunks.length; i++) {
    totalSize += chunks[i].data.length
    totalSize += 12
  }

  var output = new Uint8Array(totalSize)

  output[0] = 0x89
  output[1] = 0x50
  output[2] = 0x4E
  output[3] = 0x47
  output[4] = 0x0D
  output[5] = 0x0A
  output[6] = 0x1A
  output[7] = 0x0A

  for (i = 0; i < chunks.length; i++) {
    var chunk = chunks[i]
    var name = chunk.name
    var data = chunk.data
    var size = data.length
    var nameChars = [
      name.charCodeAt(0),
      name.charCodeAt(1),
      name.charCodeAt(2),
      name.charCodeAt(3)
    ]

    uint32[0] = size
    output[idx++] = uint8[3]
    output[idx++] = uint8[2]
    output[idx++] = uint8[1]
    output[idx++] = uint8[0]

    output[idx++] = nameChars[0]
    output[idx++] = nameChars[1]
    output[idx++] = nameChars[2]
    output[idx++] = nameChars[3]

    for (var j = 0; j < size;) {
      output[idx++] = data[j++]
    }

    var crcCheck = nameChars.concat(sliced(data))
    var crc = crc32.buf(crcCheck)

    int32[0] = crc
    output[idx++] = uint8[3]
    output[idx++] = uint8[2]
    output[idx++] = uint8[1]
    output[idx++] = uint8[0]
  }

  return output
}
