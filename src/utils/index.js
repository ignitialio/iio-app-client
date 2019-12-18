import moment from 'moment'
import 'moment/locale/fr'
import 'moment/locale/es'
import * as d3 from 'd3'
import map from 'lodash/map'
import loadjs from 'loadjs'
import jsf from 'json-schema-faker'
import jsongen from 'generate-json-schema'

export default {
  fromNow(date, lang = 'us') {
    return date ? moment(date).locale(lang).fromNow() : ''
  },

  prettyDate(date, lang = 'us') {
    return date ? moment(date).locale(lang).format('DD MMMM YYYY') : ''
  },

  prettyDateAndTime(date, lang = 'us') {
    return date ? moment(date).locale(lang).format('DD MMMM YYYY  hh:mm') : ''
  },

  loadOpenLayers(version = '4.6.5') {
    return new Promise((resolve, reject) => {
      if (!loadjs.isDefined('openlayers')) {
        loadjs(
          [
            'https://cdnjs.cloudflare.com/ajax/libs/openlayers/' + version + '/ol.css',
            'https://cdnjs.cloudflare.com/ajax/libs/openlayers/' + version + '/ol.js'
          ], 'openlayers', {
            success: () => {
              // console.log('openlayers', global.ol)
              resolve(global.ol)
            },
            error: err => reject(err)
          })
      } else {
        resolve(global.ol)
      }
    })
  },

  token() {
    return localStorage.getItem('token')
  },

  waitForDOMReady(selector, delay = 5000) {
    return new Promise((resolve, reject) => {
      let checkInterval = setInterval(() => {
        let el = d3.select(selector)
        if (!el.empty()) {
          clearInterval(checkInterval)
          clearTimeout(timeout)
          resolve(el)
        }
      }, 50)

      let timeout = setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error('timeout for DOM element ' + selector))
      }, delay)
    })
  },

  /* get image from service */
  getImage(serviceName, fileName) {
    return new Promise(async (resolve, reject) => {
      try {
        let imageData = await this.$services.getFileFromService(serviceName, fileName)
        let typedArray = new Uint8Array(imageData)
        let type = fileName.toLowerCase().match(/\.[0-9a-z]+$/i)[0].replace('.', '')
        if (type === 'svg') type += '+xml'
        if (type) {
          resolve('data:image/' + type + ';base64, ' +
            btoa(String.fromCharCode.apply(null, typedArray)))
        }
      } catch (err) {
        reject(err)
      }
    })
  },

  /* get file url selecting between S3 and other endpoints */
  fileUrl(path, defaultPath, el) {
    if (!path) {
      return defaultPath
    } else if (path.match(/\$\$service/)) {
      if (!el) return
      let m = path.match(/\$\$service\((.*?)\)\/(.*)/)
      let service = m[1]
      let partial = m[2]
      this.getImage(service, partial).then(url => {
        el.setAttribute('src', url)
      }).catch(err => console.log(err))
      return null
    } else if (path.match(/api\/s3\//)) {
      return path + '?token=' + localStorage.getItem('token')
    } else {
      return path
    }
  },

  waitForProperty(obj, prop, delay = 5000) {
    return new Promise((resolve, reject) => {
      var checkTimeout

      var checkInterval = setInterval(() => {
        if (obj[prop]) {
          clearInterval(checkInterval)
          clearTimeout(checkTimeout) // nothing if undefined

          resolve(obj[prop])
        }
      }, 100)

      checkTimeout = setTimeout(() => {
        if (checkInterval) {
          clearInterval(checkInterval)
          reject(new Error('timeout: property [ ' + prop + ' ] is not available'))
        }
      }, delay)
    })
  },

  waitForProperties(obj, props, delay = 5000) {
    return new Promise((resolve, reject) => {
      var checkTimeout
      let notReady

      var checkInterval = setInterval(() => {
        let ready = true
        notReady = []

        for (let prop of props) {
          ready = ready && obj[prop]
          if (!obj[prop]) {
            if (notReady.indexOf(prop) === -1) notReady.push(prop)
          }
        }

        if (ready) {
          clearInterval(checkInterval)
          clearTimeout(checkTimeout) // nothing if undefined

          resolve(obj)
        }
      }, 100)

      checkTimeout = setTimeout(() => {
        if (checkInterval) {
          clearInterval(checkInterval)
          reject(new Error('timeout: properties [ ' + notReady + ' ] are not available'))
        }
      }, delay)
    })
  },

  generateDataFormJSONSchema(schema) {
    jsf.option({
      failOnInvalidTypes: false,
      useDefaultValue: true,
      useExamplesValue: true,
      requiredOnly: false,
      fillProperties: true
    })

    function addRequiredFlag(schema) {
      schema._meta = schema._meta || { type: null }

      if (schema.properties) {
        schema.required = Object.keys(schema.properties)

        for (let prop in schema.properties) {
          schema.properties[prop] = addRequiredFlag(schema.properties[prop])
        }
      } else {
        if (schema.type === 'array') {
          if (schema.items.properties) {
            schema.items.required = Object.keys(schema.items.properties)
            schema.items._meta = schema.items._meta || { type: null }

            if (schema.items.type === 'object') {
              for (let prop in schema.items.properties) {
                schema.items.properties[prop] = addRequiredFlag(schema.items.properties[prop])
              }
            }
          } else if (Array.isArray(schema.items)) {
            for (let item of schema.items) {
              if (item.type === 'object') {
                for (let prop in item.properties) {
                  item.required = Object.keys(item.properties)
                  item._meta = item._meta || { type: null }

                  item.properties[prop] = addRequiredFlag(item.properties[prop])
                }
              }
            }
          }
        }
      }

      return schema
    }

    schema = addRequiredFlag(schema)
    let obj = jsf.generate(schema)

    return {
      json: obj,
      schema: schema
    }
  },

  generateJSONSchema(title, obj) {
    return jsongen(title, obj)
  },

  getByPath(obj, path) {
    path = path.split('.')

    for (let p of path) {
      let arrIndex = p.match(/(.*?)\[(.*?)\]/)

      if (arrIndex) {
        obj = obj[arrIndex[1]][arrIndex[2]]
      } else if (obj[p] !== undefined) {
        obj = obj[p]
      } else {
        return null
      }
    }

    return obj
  },

  /* simplified set of an object property based on a given path (no arrays) */
  setByPath(obj, path, value) {
    path = path.split('.')
    let level = path[0]
    let next = path.slice(1).join('.')
    if (next === '') {
      obj[level] = value
    } else {
      obj[level] = obj[level] || {}
      this.setByPath(obj[level], next, value)
    }
  },

  uuid() {
    return Math.random().toString(36).slice(2)
  }
}
