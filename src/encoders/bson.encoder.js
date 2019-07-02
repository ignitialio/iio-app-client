import BSON from 'bson'

export default {
  unpack: function(data) {
    let buffer = new Uint8Array(data)
    let deserialized = BSON.deserialize(buffer)
    return deserialized
  },
  pack: BSON.serialize
}
