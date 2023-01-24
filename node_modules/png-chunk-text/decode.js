module.exports = decode

function decode (data) {
  if (data.data && data.name) {
    data = data.data
  }

  var naming = true
  var text = ''
  var name = ''

  for (var i = 0; i < data.length; i++) {
    var code = data[i]

    if (naming) {
      if (code) {
        name += String.fromCharCode(code)
      } else {
        naming = false
      }
    } else {
      if (code) {
        text += String.fromCharCode(code)
      } else {
        throw new Error('Invalid NULL character found. 0x00 character is not permitted in tEXt content')
      }
    }
  }

  return {
    keyword: name,
    text: text
  }
}
