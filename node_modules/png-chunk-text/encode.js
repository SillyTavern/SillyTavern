module.exports = encode

function encode (keyword, content) {
  keyword = String(keyword)
  content = String(content)

  if (!/^[\x00-\xFF]+$/.test(keyword) || !/^[\x00-\xFF]+$/.test(content)) {
    throw new Error('Only Latin-1 characters are permitted in PNG tEXt chunks. You might want to consider base64 encoding and/or zEXt compression')
  }

  if (keyword.length >= 80) {
    throw new Error('Keyword "' + keyword + '" is longer than the 79-character limit imposed by the PNG specification')
  }

  var totalSize = keyword.length + content.length + 1
  var output = new Uint8Array(totalSize)
  var idx = 0
  var code

  for (var i = 0; i < keyword.length; i++) {
    if (!(code = keyword.charCodeAt(i))) {
      throw new Error('0x00 character is not permitted in tEXt keywords')
    }

    output[idx++] = code
  }

  output[idx++] = 0

  for (var j = 0; j < content.length; j++) {
    if (!(code = content.charCodeAt(j))) {
      throw new Error('0x00 character is not permitted in tEXt content')
    }

    output[idx++] = code
  }

  return {
    name: 'tEXt',
    data: output
  }
}
